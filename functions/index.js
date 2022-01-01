// const functions = require("firebase-functions");
import  * as functions from 'firebase-functions';
// const admin = require('firebase-admin');
import { initializeApp } from 'firebase-admin/app';
import express from 'express';

const app = express();

const admin = initializeApp();

const firebaseConfig = {
    apiKey: "AIzaSyBCwxOr-z8GUe3wo9FJKW0ULal6oORwCFU",
    authDomain: "socialape-9db45.firebaseapp.com",
    databaseURL: "https://socialape-9db45-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "socialape-9db45",
    storageBucket: "socialape-9db45.appspot.com",
    messagingSenderId: "566227920327",
    appId: "1:566227920327:web:36394a0bbda175b806e5e2",
    measurementId: "G-VPX5EGZ19J"
  };

//   admin.initializeApp(firebaseConfig);
//const fb = require('firebase/app');
// const { getAuth, createUserWithEmailAndPassword } = require("firebase/auth");
// import { initializeApp } from 'firebase/app';
// const firebase = initializeApp(firebaseConfig);
//const firebase = !fb.getApps.length ? fb.initializeApp(firebaseConfig) : fb.getApp();
// firebase.initializeApp(firebaseConfig, "createNewUser");

app.get('/screams', (req, res) => {
    admin
        .firestore()
        .collection('screams')
        .orderBy('createdAt', 'desc')
        .get()
        .then(data => {
            let screams = [];
            data.forEach(doc => {
                screams.push({
                    screamId: doc.id,
                    body: doc.data().body,
                    userHandle: doc.data().userHandle,
                    createdAt: doc.data().createdAt
                });
            })
            return res.json(screams);
        })
        .catch(err => console.error(err));
})


app.post( '/scream', (req, res) => {

    const newScream = {
         body: req.body.body,
         userHandle: req.body.userHandle,
         createAt: new Date().toISOString()
     };

    admin
     .firestore()
     .collection('screams')
     .add(newScream)
     .then(doc => {
        res.json({ message: `document ${doc.id} created successfully`});
     })
     .catch(err => {
         res.status(500).json({error: 'something went wrong'});
         console.error(err);
     });
});

// Signup route

// app.post('/signup', (req, res) => {
//     const newUser = {
//         email: req.body.email,
//         password: req.body.password,
//         confirmPassword: req.body.confirmPassword,
//         handle: req.body.handle,
//     }

//     //TODO validate data
//     const auth = firebase.getAuth();
//     firebase
//         // .getAuth()
//         .createUserWithEmailAndPassword(auth, newUser.email, newUser.password)
//         .then(data => {
//             return res.status(201).json({message: `user ${data.user.uid} signed up successfully` });
//         })
//         .catch(err => {
//             console.error(err);
//             return res.status(500).json({ error: err.code });
//         });
// });

export var api = functions.region('europe-west1').https.onRequest(app);
