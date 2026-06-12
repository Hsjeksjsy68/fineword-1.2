const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const toReplace = [
  "const unsub = onSnapshot(qDeactivated, snap => {\n      const ids: string[] = [];\n      snap.forEach(d => ids.push(d.id));\n      setDeactivatedUserIds(ids);\n    });",
  "const unsubscribe = onSnapshot(q, (snapshot) => {\n      const dbPosts: Post[] = [];\n      snapshot.forEach(doc => {\n        const data = doc.data();\n        if (!deactivatedUserIds.includes(data.userId) || currentUser?.id === data.userId) {\n          dbPosts.push({\n            ...data,\n            id: doc.id,\n            createdAt: data.createdAt?.toDate?.() || new Date(),\n          } as Post);\n        }\n      });\n      setPosts(dbPosts);\n    }, (error) => {\n      console.error(\"Posts fetch error:\", error.message);\n    });"
];

let replaced = code.replace(
  "const unsub = onSnapshot(qDeactivated, snap => {\n      const ids: string[] = [];\n      snap.forEach(d => ids.push(d.id));\n      setDeactivatedUserIds(ids);\n    });",
  "const unsub = onSnapshot(qDeactivated, snap => {\n      const ids: string[] = [];\n      snap.forEach(d => ids.push(d.id));\n      setDeactivatedUserIds(ids);\n    }, e => console.error(\"Deactivated users fetch error:\", e.message));"
);

fs.writeFileSync('src/App.tsx', replaced);
