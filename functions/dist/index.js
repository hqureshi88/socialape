"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.onUserImageChange = exports.onScreamDelete = exports.deleteNotificationOnUnlike = exports.createNotificationOnLike = exports.createNotificationOnComment = exports.api = void 0;

var _firebaseFunctions = _interopRequireDefault(require("firebase-functions"));

var _express = _interopRequireDefault(require("express"));

var _users = require("./handlers/users.js");

var _fbAuth = require("./util/fbAuth.js");

var _screams = require("./handlers/screams.js");

var _admin = require("./util/admin.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// const functions = require('firebase-functions');
const app = (0, _express.default)(); //scream routes

app.get('/screams', _screams.getAllScreams);
app.post('/scream', _fbAuth.FBAuth, _screams.postOneScream);
app.get('/scream/:screamId', _screams.getScream); // TODO delete scream

app.delete('/scream/:screamId', _fbAuth.FBAuth, _screams.deleteScream);
app.get('/scream/:screamId/like', _fbAuth.FBAuth, _screams.likeScream);
app.get('/scream/:screamId/unlike', _fbAuth.FBAuth, _screams.unlikeScream);
app.post('/scream/:screamId/comment', _fbAuth.FBAuth, _screams.commentOnScream); //user routes

app.post('/signup', _users.signup);
app.post('/login', _users.login);
app.post('/user/image', _fbAuth.FBAuth, _users.uploadImage);
app.post('/user', _fbAuth.FBAuth, _users.addUserDetails);
app.get('/user', _fbAuth.FBAuth, _users.getAuthenticatedUser);
app.get('/user/:handle', _users.getUserDetails);
app.post('/notifications', _fbAuth.FBAuth, _users.markNotificationsRead);

let api = _firebaseFunctions.default.region('europe-west1').https.onRequest(app);

exports.api = api;

let createNotificationOnLike = _firebaseFunctions.default.region('europe-west1').firestore.document('likes/{id}').onCreate(snapshot => {
  return _admin.db.doc(`/screams/${snapshot.data().screamId}`).get().then(doc => {
    if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
      return _admin.db.doc(`/notifications/${snapshot.id}`).set({
        createdAt: new Date().toISOString(),
        recipient: doc.data().userHandle,
        sender: snapshot.data().userHandle,
        type: 'like',
        read: false,
        screamId: doc.id
      });
    }
  }).catch(err => console.error(err));
});

exports.createNotificationOnLike = createNotificationOnLike;

let deleteNotificationOnUnlike = _firebaseFunctions.default.region('europe-west1').firestore.document('likes/{id}').onDelete(snapshot => {
  return _admin.db.doc(`/notifications/${snapshot.id}`).delete().catch(err => {
    console.error(err);
    return;
  });
});

exports.deleteNotificationOnUnlike = deleteNotificationOnUnlike;

let createNotificationOnComment = _firebaseFunctions.default.region('europe-west1').firestore.document('comments/{id}').onCreate(snapshot => {
  return _admin.db.doc(`/screams/${snapshot.data().screamId}`).get().then(doc => {
    if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
      return _admin.db.doc(`/notifications/${snapshot.id}`).set({
        createdAt: new Date().toISOString(),
        recipient: doc.data().userHandle,
        sender: snapshot.data().userHandle,
        type: 'comment',
        read: false,
        screamId: doc.id
      });
    }
  }).catch(err => {
    console.error(err);
    return;
  });
});

exports.createNotificationOnComment = createNotificationOnComment;

let onUserImageChange = _firebaseFunctions.default.region('europe-west1').firestore.document('/users/{userId}').onUpdate(change => {
  console.log(change.before.data());
  console.log(change.after.data());

  if (change.before.data().imageUrl !== change.after.data().imageUrl) {
    console.log('image had changed');

    let batch = _admin.db.batch();

    return _admin.db.collection('screams').where('userHandle', '==', change.before.data().handle).get().then(data => {
      data.forEach(doc => {
        const scream = _admin.db.doc(`/screams/${doc.id}`);

        batch.update(scream, {
          userImage: change.after.data().imageUrl
        });
      });
      return batch.commit();
    });
  } else return true;
});

exports.onUserImageChange = onUserImageChange;

let onScreamDelete = _firebaseFunctions.default.region('europe-west1').firestore.document('/screams/{screamId}').onDelete((snapShot, context) => {
  const screamId = context.params.screamId;

  const batch = _admin.db.batch();

  return _admin.db.collection('comments').where('screamId', '==', screamId).get().then(data => {
    data.forEach(doc => {
      batch.delete(_admin.db.doc(`/comments/${doc.id}`));
    });
    return _admin.db.collection('likes').where('screamId', '==', screamId).get();
  }).then(data => {
    data.forEach(doc => {
      batch.delete(_admin.db.doc(`/likes/${doc.id}`));
    });
    return _admin.db.collection('notifications').where('screamId', '==', screamId).get();
  }).then(data => {
    data.forEach(doc => {
      batch.delete(_admin.db.doc(`/notifications/${doc.id}`));
    });
    return batch.commit();
  }).catch(err => console.error(err));
});

exports.onScreamDelete = onScreamDelete;