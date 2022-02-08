import * as firebaseAdminAuth from 'firebase-admin/auth';
import { adminApp, db } from './admin.js';

export const FBAuth = (req, res, next) => {
    let idToken;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer ')){
        idToken = req.headers.authorization.split('Bearer ')[1];
        console.log("Token:",idToken);
    } else {
        // console.error('No token found');
        return res.status(403).json({ error: 'Unauthorized'});
    }
    firebaseAdminAuth.getAuth(adminApp)
        .verifyIdToken(idToken)
        .then(decodedToken => {
            req.user = decodedToken;
            const col = db.collection('users')
            console.log('does it works????');

            return col.where('userId', '==', req.user.uid)
                .limit(1)
                .get();
        })
        .then(data => {
            // console.log(data);
            req.user.handle = data.docs[0].data().handle;
            req.user.imageUrl = data.docs[0].data().imageUrl;
            return next();
        })
        .catch(err => {
            console.error('Error while verifying token ', err);
            return res.status(403).json(err);
        })
}