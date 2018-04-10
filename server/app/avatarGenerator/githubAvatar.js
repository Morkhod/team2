'use strict';

const CryptoJS = require('crypto-js');
const Identicon = require('identicon.js');

class GithubAvatar {
    constructor(login, size) {
        this.hash = CryptoJS.MD5(login).toString();
        this.size = size;
    }

    toBase64() {
        return new Identicon(this.hash, this.size).toString();
    }

    toImgSrc(){
        return 'data:image/png;base64,' + this.toBase64();
    }
}

module.exports = GithubAvatar;
