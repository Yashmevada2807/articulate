
try {
    const pkg = require('word-pictionary-list');
    console.log("Type:", typeof pkg);
    console.log("Exports:", pkg);
    if (typeof pkg === 'function') {
        console.log("Result of execution:", pkg());
    }
} catch (e) {
    console.error(e);
}
