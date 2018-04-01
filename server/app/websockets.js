/* eslint-disable new-cap */
'use strict';

const PassportMemStoreSessionGetter = require('./classes/PassportMemStoreSessionGetter');
const WebSocketServer = require('./classes/WebSocketServer');

const {
    ChatModel,
    UserModel,
    UserIdLoginModel,
    messageModelFactory
} = require('./models');

module.exports = function (app, sessionStore) {
    const sessionGetter = new PassportMemStoreSessionGetter(sessionStore);
    const wsServer = new WebSocketServer(app, sessionGetter);

    wsServer.on('authUserConnected', ({ socket, uid }) => {
        socket.on('GetMessages', execute.bind(null, wsServer, uid, GetMessages));
        socket.on('GetProfile', execute.bind(null, wsServer, uid, GetProfile));
        socket.on('SearchByLogin', execute.bind(null, wsServer, uid, SearchByLogin));
        socket.on('AddContact', async (userId) => {
            try {
                const result = await AddContact(uid, userId);

                wsServer.emitByUID(uid, 'AddContactResult', {
                    success: true,
                    value: result
                });

                wsServer.emitByUID(uid, 'NewChat', result);
            } catch (error) {
                wsServer.emitByUID(uid, 'AddContactResult', {
                    success: false,
                    error: error.message || error.body
                });
            }
        });
        socket.on('GetChatList', execute.bind(null, wsServer, uid, GetChatList));
        socket.on('SendMessage', async ({ chatId, text }) => {
            try {
                const message = SendMessage(uid, chatId, text);
                const chat = await ChatModel.getById(chatId);

                wsServer.emitByUID(uid, 'SendMessageResult', {
                    success: true,
                    value: message
                });
                chat.users.forEach(userId => {
                    wsServer.emitByUID(userId, 'NewMessage', message);
                });
            } catch (error) {
                wsServer.emitByUID(uid, 'SendMessageResult', {
                    success: false,
                    error: error.message || error.body
                });
            }
        });
    });
};

async function execute(wsServer, uid, fn, data) {
    try {
        const result = await fn(uid, data);

        wsServer.emitByUID(uid, fn.name + 'Result', {
            success: true,
            value: result
        });
    } catch (error) {
        wsServer.emitByUID(uid, fn.name + 'Result', {
            success: false,
            error: error.message || error.body
        });
    }
}

async function SendMessage(uid, chatId, text) {
    const chat = await ChatModel.getById(chatId);

    if (chat.users.indexOf(uid) === -1) {
        throw new Error('Not your chat!');
    }

    const MessageModel = messageModelFactory(chatId);
    const message = new MessageModel({
        from: uid,
        body: text
    });

    await message.save();
    message.chatId = chatId;

    return message;
}

async function GetMessages(uid, { chatId, offset, limit }) {
    const chat = await ChatModel.getById(chatId);

    if (chat.users.indexOf(uid) === -1) {
        throw new Error('Not your chat!');
    }

    const MessageModel = messageModelFactory(chatId);

    return MessageModel.getList({
        offset: offset || 0,
        limit: limit || 100
    });
}

async function GetProfile(uid, userId) {
    const user = await UserModel.getById(userId || uid);

    return getProfileFromUser(user);
}

async function SearchByLogin(uid, login) {
    const foundUsers = [];
    const allUsersIterator = UserIdLoginModel.getIterator();
    const userIdAndLogin = await allUsersIterator.next();
    while (userIdAndLogin) {
        if (userIdAndLogin.login.indexOf(login) !== -1) {
            foundUsers.push(getProfileFromUser(await userIdAndLogin.getByLink('userId')));
        }
        userIdAndLogin = await allUsersIterator.next();
    }

    return foundUsers;
}

async function AddContact(uid, userId) {
    if (uid === userId) {
        throw new Error('You can\'t add yourself!');
    }

    await UserModel.getById(userId);

    const me = await UserModel.getById(uid);
    me.add(userId);

    const chat = new ChatModel({
        dialog: true,
        users: [uid, userId]
    });

    await chat.save();

    return getChatForEmit(chat, uid);
}

async function GetChatList(uid) {
    const user = await UserModel.getById(uid);

    const result = [];
    for (const chatId of user.chats) {
        const chat = await ChatModel.getById(chatId);
        const emitChat = await getChatForEmit(chat);

        result.push(emitChat);
    }

    return result;
}

async function getChatForEmit(chat, uid) {
    const users = await chat.getByLink('users');

    const result = {
        id: chat.id,
        name: chat.name,
        dialog: chat.dialog,
        users: users.map(getProfileFromUser)
    };

    const userForAvatar = await UserModel.getById(chat.users.filter(u => u !== uid)[0]);
    result.avatar = userForAvatar.avatar;

    return result;
}

async function getProfileFromUser(user) {
    return {
        id: user.id,
        login: user.login,
        avatar: user.avatar
    };
}