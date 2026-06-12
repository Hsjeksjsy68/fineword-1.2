const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

// The current update rule:
//       allow update: if isValidId(userId)
//                     && isValidUser(incoming())
//                     && incoming().id == existing().id // id cannot change
//                     && (
//                       (
//                         isOwner(userId)
//                         && incoming().diff(existing()).affectedKeys().hasOnly(['username', 'name', 'avatar', 'bio', 'theme', 'verificationStatus', 'verificationData', 'deactivated', 'hideBadges', 'activeBadgeId', 'lastActive'])
//                         && (!('verificationStatus' in incoming().diff(existing()).affectedKeys()) || incoming().verificationStatus in ['pending', 'none'])
//                       )
//                       ||
//                       (
//                         isAdmin()
//                       )
//                       ||
//                       (
//                         isSignedIn()
//                         && incoming().diff(existing()).affectedKeys().hasOnly(['badges', 'reportCount'])
//                       )
//                     );

const oldRule = `allow update: if isValidId(userId)
                    && isValidUser(incoming())
                    && incoming().id == existing().id // id cannot change
                    && (
                      (
                        isOwner(userId)
                        && incoming().diff(existing()).affectedKeys().hasOnly(['username', 'name', 'avatar', 'bio', 'theme', 'verificationStatus', 'verificationData', 'deactivated', 'hideBadges', 'activeBadgeId', 'lastActive'])
                        && (!('verificationStatus' in incoming().diff(existing()).affectedKeys()) || incoming().verificationStatus in ['pending', 'none'])
                      )
                      ||
                      (
                        isAdmin()
                      )
                      ||
                      (
                        isSignedIn()
                        && incoming().diff(existing()).affectedKeys().hasOnly(['badges', 'reportCount'])
                      )
                    );`;

const newRule = `allow update: if isAdmin() || (isValidId(userId)
                    && isValidUser(incoming())
                    && incoming().id == existing().id // id cannot change
                    && (
                      (
                        isOwner(userId)
                        && incoming().diff(existing()).affectedKeys().hasOnly(['username', 'name', 'avatar', 'bio', 'theme', 'verificationStatus', 'verificationData', 'deactivated', 'hideBadges', 'activeBadgeId', 'lastActive'])
                        && (!('verificationStatus' in incoming().diff(existing()).affectedKeys()) || incoming().verificationStatus in ['pending', 'none'])
                      )
                      ||
                      (
                        isSignedIn()
                        && incoming().diff(existing()).affectedKeys().hasOnly(['badges', 'reportCount'])
                      )
                    ));`;

code = code.replace(oldRule, newRule);
fs.writeFileSync('firestore.rules', code);
