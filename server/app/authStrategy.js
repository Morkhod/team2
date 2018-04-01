'use strict';

require('dotenv').config();
const passportGithub = require('passport-github');
const Github = require('./models/github');
const User = require('./models/user');

Github.makeLink('uid', User);

const strategy = new passportGithub.Strategy(
    {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: 'http://localhost:8080/login/return'
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const github = await Github.getById(profile.id);
            const user = await User.getById(github.uid);

            console.info(`User exist ${user.login}`);
            done(null, user);
        } catch (error) {
            console.info(error);

            const user = new User({
                login: profile.username,
                name: profile.displayName,
                githubId: profile.id,
                contacts: [],
                chats: [],
                date: Date.now()
            });

            const github = new Github({
                id: profile.id,
                uid: user.id
            });

            await github.save();
            await user.save();

            done(null, user);
        }
    }
);

module.exports = { strategy };