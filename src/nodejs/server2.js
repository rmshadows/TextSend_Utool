"use strict";

// const s = require('./server');

// s.closeAllServers();

let s = [1, 2, 3, 4];
    let as = s.filter((x) => {
        if (x == 2){
            return false;
        }
        return true;
    })
console.log(as);


