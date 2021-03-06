'use strict';

const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    avatar: String,
    name: String,
    dialog: Boolean,
    users: [{ type: mongoose.Schema.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now }
});

chatSchema.methods.addUser = function (personId) {
    this.users.push(personId);

    return this.save();
};

chatSchema.methods.containsUser = function (userName) {
    return this.users.indexOf(mongoose.Types.ObjectId(userName)) !== -1;
};

module.exports = mongoose.model('Chat', chatSchema);
