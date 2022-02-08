import functions from 'firebase-functions';
// const functions = require('firebase-functions');
import express from 'express';
import { signup, login, uploadImage, addUserDetails, getAuthenticatedUser, getUserDetails, markNotificationsRead } from './handlers/users.js';
import { FBAuth } from './util/fbAuth.js';
import { getAllScreams, postOneScream, getScream, commentOnScream, likeScream, unlikeScream, deleteScream } from './handlers/screams.js';
import { db } from './util/admin.js';

const app = express();

  //scream routes
app.get('/screams', getAllScreams);
app.post('/scream', FBAuth, postOneScream);
app.get('/scream/:screamId', getScream);
// TODO delete scream
app.delete('/scream/:screamId', FBAuth, deleteScream);
app.get('/scream/:screamId/like', FBAuth, likeScream);
app.get('/scream/:screamId/unlike', FBAuth, unlikeScream);
app.post('/scream/:screamId/comment', FBAuth, commentOnScream);

  //user routes
app.post('/signup', signup);
app.post('/login', login);
app.post('/user/image', FBAuth, uploadImage);
app.post('/user', FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);
app.get('/user/:handle', getUserDetails);
app.post('/notifications', FBAuth, markNotificationsRead);

export let api = functions.region('europe-west1').https.onRequest(app);

export let createNotificationOnLike = functions
  .region('europe-west1').firestore
  .document('likes/{id}')
  .onCreate((snapshot) => {
    return db.doc(`/screams/${snapshot.data().screamId}`)
    .get()
    .then(doc => {
      if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
        return db.doc(`/notifications/${snapshot.id}`).set({
          createdAt: new Date().toISOString(),
          recipient: doc.data().userHandle,
          sender: snapshot.data().userHandle,
          type: 'like',
          read: false,
          screamId: doc.id
        })
      }
    })
    .catch(err => 
      console.error(err));
  })

export let deleteNotificationOnUnlike = functions
.region('europe-west1')
.firestore.document('likes/{id}')
.onDelete((snapshot) => {
    return db.doc(`/notifications/${snapshot.id}`)
    .delete()
    .catch(err => {
      console.error(err);
      return;
    })

  })

export let createNotificationOnComment = functions
.region('europe-west1')
.firestore.document('comments/{id}')
.onCreate((snapshot) => {
    return db.doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then(doc => {
        if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'comment',
            read: false,
            screamId: doc.id
          })
        }
      })
      .catch(err => {
        console.error(err);
        return;
      })
  })

export let onUserImageChange = functions
  .region('europe-west1')
  .firestore.document('/users/{userId}')
  .onUpdate((change) => {
    console.log(change.before.data())
    console.log(change.after.data())

    if(change.before.data().imageUrl !== change.after.data().imageUrl){
      console.log('image had changed');
      let batch = db.batch();
      return db
        .collection('screams')
        .where('userHandle', '==', change.before.data().handle)
        .get()
        .then((data)=>{
          data.forEach(doc => {
            const scream = db.doc(`/screams/${doc.id}`)
            batch.update(scream, {userImage: change.after.data().imageUrl});
          });
          return batch.commit();
        })
    } else return true;
  });

  export let onScreamDelete = functions
    .region('europe-west1')
    .firestore.document('/screams/{screamId}')
    .onDelete((snapShot, context) => {
      const screamId = context.params.screamId;
      const batch = db.batch()
      return db.collection('comments').where('screamId', '==', screamId).get()
        .then(data => {
          data.forEach(doc => {
            batch.delete(db.doc(`/comments/${doc.id}`));
          })
          return db.collection('likes').where('screamId', '==', screamId).get()
        })
        .then(data => {
          data.forEach(doc => {
            batch.delete(db.doc(`/likes/${doc.id}`));
          })
          return db.collection('notifications').where('screamId', '==', screamId).get()
        })
        .then(data => {
          data.forEach(doc => {
            batch.delete(db.doc(`/notifications/${doc.id}`));
          })
          return batch.commit();
        })
        .catch(err => console.error(err));
    })