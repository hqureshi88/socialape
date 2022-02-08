import { getDoc, doc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from '../util/config.js';
import { adminApp, db } from "../util/admin.js";
import { getStorage } from 'firebase-admin/storage';

const firebaseApp = initializeApp(firebaseConfig, "firebaseApp");

const db_b = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

import { validateSignupData, validateLoginData, reduceUserDetails } from '../util/validators.js';
    
// Sign users up

export const signup = (req, res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle,
    }

    const { valid, errors } = validateSignupData(newUser);

    if(!valid) return res.status(400).json(errors);

    const noImg = 'no-image.png';
    
    //TODO validate data
    let token, userId;
    async function userCheck() {
        try {
            const getDocRef = await getDoc(doc(db_b,"users", newUser.handle));
            if(getDocRef.exists()){
                return res.status(400).json({ handle: 'this handle is already taken'});
            } else {   
                return createUserWithEmailAndPassword(auth, newUser.email, newUser.password);   
            }
        } catch (err) {
            res.status(500).json({error: 'something went wrong'});
            console.error(err);
        }
    }
    userCheck()
    .then((data) => {
        userId = data.user.uid;
        return data.user.getIdToken()
    })
    .then((idToken) => {
        token = idToken;
        const userCredentials = {
            handle: newUser.handle,
            email: newUser.email,
            createdAt: new Date().toISOString(),
            imageUrl: `https://firebasestorage.googleapis.com/v0/b/${
                firebaseConfig.storageBucket
            }/o/${noImg}?alt=media`,
            userId
        };

        async function setUser(){
            return await setDoc(doc(db_b, `users/${newUser.handle}`), userCredentials);
        }
        
        setUser();
    })
    .then(() => {
        return res.status(201).json({ token });
    })
    .catch(err => {
        console.error(err);
        if(err.code === "auth/email-already-in-use"){
            return res.status(400).json({ email: 'Email is already in use' });
        } else {
            return res.status(500).json({ general: 'Something went wrong, please try again' });
        }
    });
}

// Log user in

export const login = (req, res) => {
    const user = {
        email: req.body.email,
        password: req.body.password
    };

    const { valid, errors } = validateLoginData(user);

    if(!valid) return res.status(400).json(errors);

    signInWithEmailAndPassword(auth, user.email, user.password)
        .then(data => { 
        return data.user.getIdToken()
        })
        .then(token => {
            return res.json({ token });
        })
        .catch(err => {
          console.error("test:", err);
          // auth/wrong-password
          // auth/user-not-user
          return res
            .status(403)
            .json({ general: 'Wrong credentials, please try again'});
        })
    

}

import Busboy from 'busboy';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// add user details

export const addUserDetails = (req, res) => {
    let userDetails = reduceUserDetails(req.body);

    db.doc(`/users/${req.user.handle}`).update(userDetails)
    .then(() => {
        return res.json({message: 'Details added successfully'});
    })
    .catch(err => {
        console.error(err);
        return res.status(500).json({error: err.code})
    })
}

// Get any user's details

export const getUserDetails = (req, res) => {
    let userData = {};
    db.doc(`/users/${req.params.handle}`).get()
    .then(doc=>{
        if(doc.exists){
            userData.user = doc.data();
            return db.collection('screams').where('userHandle', '==', req.params.handle)
                .orderBy('createdAt', 'desc')
                .get()
        } else {
            return res.status(404).json({error: 'User not found'});
        }
    })
    .then(data => {
        userData.screams = [];
        data.forEach(doc => {
            userData.screams.push({
                body: doc.data().body,
                createdAt: doc.data().createdAt,
                userHandle: doc.data().userHandle,
                userImage: doc.data().userImage,
                likeCount: doc.data().likeCount,
                commentCount: doc.data().commentCount,
                screamId: doc.id
            })
        });
        return res.json(userData)
    })
    .catch(err => {
        console.error(err);
        return res.status(500).json({error: err.code});
    })
}
// Get own user details

export const getAuthenticatedUser = (req, res) => {
    let userData = {};
    db.doc(`/users/${req.user.handle}`).get()
    .then(doc => {
        // console.log(doc);
        if(doc.exists){
            userData.credentials = doc.data();
            return db.collection('likes').where('userHandle', '==', req.user.handle).get();
        }
    })
    .then(data => {
        // console.log(data);
        userData.likes = [];
        data.forEach(doc => {
            userData.likes.push(doc.data());
        });
        return db.collection('notifications').where('recipient', '==', req.user.handle)
            .orderBy('createdAt', 'desc').limit(10).get();
    })
    .then(data => {
        userData.notifications = [];
        data.forEach(doc => {
            userData.notifications.push({
                recipient: doc.data().recipient,
                sender: doc.data().sender,
                createdAt: doc.data().createdAt,
                screamId: doc.data().screamId,
                type: doc.data().type,
                read: doc.data().read,
                notificationId: doc.id
            })
        });
        return res.json(userData);
    })
    .catch(err => {
        console.error(err);
        return res.status(500).json({error: err.code});
    })
}

// upload a profile image for user

export const uploadImage = (req, res) => {

    const busboy = Busboy({ headers: req.headers });

    let imageFilename;
    let imageToBeUploaded = {};

    
    busboy.on('file', (name, file, info) => {
        // console.log(name);
        
        const mimeType = info.mimeType;

        if(mimeType !== 'image/jpeg' && mimeType !== 'image/png'){
            return res.status(400).json({error: 'Wrong file type submitted'});
        }

        //my.image.png
        const imageExtension = info.filename.split('.')[info.filename.split('.').length-1];
        //64523445374725437.png
        imageFilename = `${Math.round(Math.random()*100000000000)}.${imageExtension}`;
        const filepath = path.join(os.tmpdir(), imageFilename);
        imageToBeUploaded = { filepath, mimeType };
        file.pipe(fs.createWriteStream(filepath));
    });

    busboy.on('finish', () => {
        getStorage(adminApp).bucket().upload(imageToBeUploaded.filepath, {
            resumable: false,
            metadata: {
                metadata: {
                    contentType: imageToBeUploaded.mimetype
                }
            }
        })
        .then(() => {
            const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${
                firebaseConfig.storageBucket
            }/o/${imageFilename}?alt=media`;
            return db.doc(`/users/${req.user.handle}`).update({imageUrl})
        })
        .then(() => {
            return res.json({ message: 'image uploaded successfully!'})
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
    });
    busboy.end(req.rawBody);
};

export const markNotificationsRead = (req, res) => {
    let batch = db.batch();
    req.body.forEach(notificationId => {
        const notification = db.doc(`/notifications/${notificationId}`);
        batch.update(notification, { read: true })
    });
    batch.commit()
        .then(() => {
            return res.json({ message: 'Notifications marked read'})
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
}