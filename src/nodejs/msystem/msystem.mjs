/**
 * 系统操作模块，默认同步直接返回值，异步返回Promise
 * EES6: https://es6.ruanyifeng.com/#README
 */
import clipboard from 'clipboardy';
import fs from 'fs';
import * as L from 'list'
import path from 'path';
import chalk from 'chalk';
import fse from 'fs-extra';
import child_process from 'child_process';
import n_readlines from 'n-readlines';
import readline from 'readline';
import { setTimeout } from 'node:timers/promises';
import os from 'os';
import { log } from 'console';

const lineByLine = n_readlines;
const fsPromise = fs.promises;


/**
 * 模块内部函数
export const cp = (src, dst, sync = true, recursive = false, overwrite = true) => {
    let fn = getExecFunction().name;
    if(sync){
        try {
        
        } catch (error) {
            console.log("%s: " + error, fn);
        }
    }
}
 */
/**
 * 获取当前运行的函数名称
 * @returns type:function 函数名
 */
export const getExecFunction = () => {
    let names = new Error().stack.match(/at (.*?) /g);
    let name = names[1].replace('at ', '').trim();
    return eval(name);
}
/**
 * 默认回调函数
 * let name = getExecFunction().name;
 * fs.mkdir(dir, { recursive: recursive, mode: mode }, (err, data) => defaultCallback(err, data, name));
 * @param {*} err 
 * @param {*} data 
 * @param {string} funcname 函数名 
 */
const defaultCallback = (err, data, funcname) => {
    if (err) {
        console.log(err);
    } else {
        // process.stdout.write(funcname);
        console.log("Default callback: Function " + funcname + "() has reached callback.");
    }
}
/**
 * 默认的用于Promise的函数
 * @param {*} fn 参数列表 这里默认函数名
 */
const onSuccess = (fn) => {
    console.log(fn[0] + " Success.");
}
const onFailed = (fn) => {
    console.log(fn[0] + " Failed.");
}



/**
 * Std out
 */

/**
 * 简单的终端颜色 模式 ：成功绿0，失败红1，信息蓝2，信息黄3，信息紫4，信息黑5，信息白6
 * fg, bg:
    前景            背景              颜色
    ---------------------------------------
    30                40              黑色
    31                41              紅色
    32                42              綠色
    33                43              黃色
    34                44              藍色
    35                45              紫紅色
    36                46              青藍色
    37                47              白色
 * 
 * display:
    0                终端默认设置
    1                高亮显示
    4                使用下划线
    5                italic 闪烁(暂不支持闪烁，用italic代替)
    7                反显
    8                不可见
 * @param {*} str 字符串
 * @param {*} fg 前景色
 * @param {*} bg 背景色
 * @param {*} display 显示模式
 */
export const print = (str, fg = 31, bg = 0, display = 1) => {
    var logd = chalk;
    if (display == 0) {
        logd = logd.reset;
    } else if (display == 1) {
        logd = logd.bold;
    } else if (display == 4) {
        logd = logd.underline;
    } else if (display == 5) {
        // 暂不支持闪烁
        logd = logd.italic;
    } else if (display == 7) {
        logd = logd.inverse;
    } else if (display == 8) {
        logd = logd.hidden;
    }
    if (fg == 30) {
        logd = logd.blackBright;
    } else if (fg == 31) {
        logd = logd.redBright;
    } else if (fg == 32) {
        logd = logd.greenBright;
    } else if (fg == 33) {
        logd = logd.yellowBright;
    } else if (fg == 34) {
        logd = logd.blueBright;
    } else if (fg == 35) {
        logd = logd.magentaBright;
    } else if (fg == 36) {
        logd = logd.cyanBright;
    } else if (fg == 37) {
        logd = logd.whiteBright;
    }

    if (bg == 40) {
        logd = logd.bgBlackBright;
    } else if (bg == 41) {
        logd = logd.bgRedBright;
    } else if (bg == 42) {
        logd = logd.bgGreenBright;
    } else if (bg == 43) {
        logd = logd.bgYellowBright;
    } else if (bg == 44) {
        logd = logd.bgBlueBright;
    } else if (bg == 45) {
        logd = logd.bgMagentaBright;
    } else if (bg == 46) {
        logd = logd.bgCyanBright;
    } else if (bg == 47) {
        logd = logd.bgWhiteBright;
    }
    console.log(logd(str));
}

/**
 * 常用显示
0:成功 绿 success s
1:失败 红 error e
2:信息 蓝 info i
3:警告 黄 warn w
4:白 message  m
 * @param {*} str 
 * @param {*} mode 
 */
export const prompt = (str, mode = 4) => {
    if (mode == 0 || mode == "s") {
        print(str, 32);
    } else if (mode == 1 || mode == "e") {
        print(str, 31);
    } else if (mode == 2 || mode == "i") {
        print(str, 34);
    } else if (mode == 3 || mode == "w") {
        print(str, 33);
    } else if (mode == 4 || mode == "m") {
        print(str, 37);
    }
}


export const prompts = (str) => {
    prompt(str, "s");
}
export const prompte = (str) => {
    prompt(str, "e");
}
export const prompti = (str) => {
    prompt(str, "i");
}
export const promptw = (str) => {
    prompt(str, "w");
}
export const promptm = (str) => {
    prompt(str, "m");
}


/**
 * 获取文件分隔符
 * @returns 
 */
export const getFileSeparator = () => {
    return path.sep;
}


/**
 * 是否是Windows系统
 * @returns 
 */
export const isWindows = () => {
    return getFileSeparator() == "\\";
}


/**
 * 运行命令
 * 切勿将未经处理的用户输入传递给此函数。 任何包含 shell 的输入 元字符可用于触发任意命令执行
 * [p.status, p.stdout, p.stderr, p.signal, p.error, p.pid]
 * @param {string} cmd  要运行的命令
 * @param {boolean} easymode true: exec false:spwan
 * @param {boolean} sync 是否同步，默认true
 * @param {string} pwd 子进程的当前工作目录
 * @param {string} timeout 允许进程运行的最长时间（以毫秒为单位）。 默认值: undefined。
 * @param {Function} callback child_process.exec的回调函数 callback = (error, stdout, stderr) => {...
 * @param {boolean/string} shell 用于执行命令的 shell。 请参阅 shell 的要求和默认的 Windows shell。 默认值: true => Unix 上是 '/bin/sh'，Windows 上是 process.env.ComSpec
 * @param {string} killSignal <string> | <integer> 衍生的进程将被终止时要使用的信号值。 默认值: 'SIGTERM'。
 * @param {number} maxBuffer 标准输出或标准错误上允许的最大数据量（以字节为单位）。 如果超过，则子进程将终止并截断任何输出。 请参阅 maxBuffer 和 Unicode 的注意事项。 默认值: 1024 * 1024。
 * @param {string} encoding  用于所有标准输入输出的输入和输出的编码。 默认值: 'utf-8'。
 * @param {boolean} windowsHide 隐藏通常在 Windows 系统上创建的子进程控制台窗口。 默认值: false。
 * @returns 
 */
export const execCommand = (cmd, easymode = true, sync = true,
    pwd = ".", timeout = undefined,
    callback = undefined, shell = true,
    killSignal = 'SIGTERM', maxBuffer = 1024 * 1024,
    encoding = 'utf-8', windowsHide = false) => {
    // encoding = 'buffer'
    let fn = getExecFunction().name;

    if (callback == undefined) {
        callback = (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return;
            }
            console.log(`stdout: \n${stdout}`);
            console.log(`stderr: \n${stderr}`);
        }
    }

    if (shell === true) {
        if (isWindows()) {
            shell = "process.env.ComSpec"
        } else {
            shell = "/bin/bash"
        }
    }

    if (sync) {
        if (easymode) {
            try {
                return child_process.execSync(cmd, {
                    cwd: pwd, shell: shell,
                    timeout: timeout, killSignal: killSignal,
                    maxBuffer: maxBuffer, encoding: encoding, windowsHide: windowsHide
                });
            } catch (error) {
                console.log("%s: " + error, fn);
                return error;
            }
        } else {
            try {
                // https://juejin.cn/s/node%E6%89%A7%E8%A1%8Cshell%E8%8E%B7%E5%8F%96%E5%AE%9E%E6%97%B6%E8%BE%93%E5%87%BA
                /**
                 * 
                 * 返回: <Object>
    pid <number> 子进程的 pid。
    output <Array> 来自标准输入输出的输出的结果数组。
    stdout <Buffer> | <string> output[1] 的内容。
    stderr <Buffer> | <string> output[2] 的内容。
    status <number> | <null> 子进程的退出码，如果子进程因信号而终止，则为 null。
    signal <string> | <null> 用于终止子进程的信号，如果子进程没有因信号而终止，则为 null。
    error <Error> 如果子进程失败或超时，则为错误对象。
                 */
                let c = cmd.split(" ");
                let cmdopt = [];
                let cn = -1;
                c.forEach(el => {
                    if (cn == -1) {
                        cmd = el;
                    } else {
                        cmdopt[cn] = el;
                    }
                    cn += 1;
                });
                let p = child_process.spawnSync(cmd, cmdopt, {
                    cwd: pwd, shell: shell,
                    timeout: timeout, killSignal: killSignal,
                    maxBuffer: maxBuffer, encoding: encoding, windowsHide: windowsHide
                });
                prompti(p.stdout);
                prompte(p.stderr);
                return [p.status, p.stdout, p.stderr, p.signal, p.error, p.pid]
            } catch (error) {
                console.log("%s: %s", fn, error);
                return error;
            }
        }
    } else {
        if (easymode) {
            child_process.exec(cmd, callback);
        } else {
            let c = cmd.split(" ");
            let cmdopt = [];
            let cn = -1;
            c.forEach(el => {
                if (cn == -1) {
                    cmd = el;
                } else {
                    cmdopt[cn] = el;
                }
                cn += 1;
            });
            let p = child_process.spawn(cmd, cmdopt, {
                cwd: pwd, shell: shell,
                timeout: timeout, killSignal: killSignal,
                maxBuffer: maxBuffer, encoding: encoding, windowsHide: windowsHide,

            });

            // p.stdout.on('data', (data) => {
            //     console.log(`stdout: ${data}`);
            // });

            // p.stderr.on('data', (data) => {
            //     console.error(`stderr: ${data}`);
            // });

            // p.on('close', (code) => {
            //     console.log(`child process exited with code ${code}`);
            // });
            return p;
        }
    }
}


/**
 * clipboardy粘贴板操作
 */
/**
 * clipboardy设置粘贴板
 * @param {string} content content 内容
 * @param {boolean} sync 是否同步， if true Doesn't work in browsers.
 * @returns 返回字符串内容/async: None
 */
export const setClipboard = (content, sync = true) => {
    if (sync) {
        let result = false;
        // Doesn't work in browsers.
        try {
            clipboard.writeSync(content);
            if (clipboard.readSync() === content) {
                result = true;
            } else {
                console.log("setClipboard: 似乎失败了");
            }
            // console.log("setClipboard:设置粘贴板:" + content);
        } catch (error) {
            console.log("setClipboard failed:" + error);
        }
        return result;
    } else {
        return clipboard.write(content);
    }
};


/**
 * clipboardy获取系统粘贴板信息
 * @param {boolean} sync 是否同步，If false, Doesn't work in browsers.
 * @returns 返回字符串内容/async:Promise
 */
export const getClipboard = (sync = true) => {
    if (sync) {
        let content = "";
        try {
            content = clipboard.readSync();
            // console.log("getClipboard:粘贴板读取:" + content);
        } catch (error) {
            console.log("getClipboard failed:" + error);
        }
        return content;
    } else {
        return clipboard.read();
    }
}


/**
 * 打印列表
 * @param {Array} list 
 * @param {*} promptMode 
 */
export const prlst = (list, promptMode = 0) => {
    list.forEach((x) => {
        prompt(x, promptMode);
    });
}

/**
 * 返回环境变量分隔符
 * @returns 
 */
export const getPathSeparator = () => {
    return path.delimiter;
}

/**
 * 获取环境变量
 * @returns 
 */
export const getPath = () => {
    let p = L.empty();
    process.env.PATH.split(path.delimiter).forEach(function (dir) {
        p = L.append(dir, p);
    });
    return L.toArray(p);
}


/**
 * 去除重复数组元素
 * @param {*} arr 
 * @returns 
 */
export const arrayRemoveDuplicates = (arr) => {
    return arr.filter(function (elem, index, self) {
        return index === self.indexOf(elem);
    });
}


/**
 * 文件IO操作
 */
/**
 * 判断文件类型 文件：1 文件夹：2 链接文件：3
 * @param {String} filepath 
 * @param {boolean} sync 
 * @returns Number / Promise
 */
export const fileType = (filepath, sync = true) => {
    let fn = getExecFunction().name;
    try {
        if (sync) {
            let t = 0;
            let fstat = fs.lstatSync(filepath);
            if (fstat.isSymbolicLink()) {
                // console.log(filepath + "是链接文件");
                t = 3;
            } else if (fstat.isFile()) {
                // console.log(filepath + "是文件");
                return 1;
            } else if (fstat.isDirectory()) {
                // console.log(filepath + "是文件夹");
                return 2;
            } else {
                console.log(filepath + "处于未知状态");
                return -1;
            }
            return t;
        } else {
            return fsPromise.lstat(filepath).then((fstat) => {
                console.log(typeof fstat);
                if (fstat.isSymbolicLink()) {
                    // console.log(filepath + "是链接文件");
                    return 3;
                } else if (fstat.isFile()) {
                    // console.log(filepath + "是文件");
                    return 1;
                } else if (fstat.isDirectory()) {
                    // console.log(filepath + "是文件夹");
                    return 2;
                } else {
                    console.log(filepath + "处于未知状态");
                    return -1;
                }
            });
        }
    } catch (error) {
        console.log("fileType(): " + error);
    }
}

/**
 * ls
 * @param {string} filepath 路径
 * @param {boolean} sync 是否同步 默认true
 * @param {boolean} showHidden 是否显示隐藏文件 默认否
 * @param {boolean} followLinks 是否跟随链接文件，默认否
 * @param {boolean} absolutePath 是否返回绝对路径，默认是
 * @returns 列表
 */
export const ls = (filepath, sync = true, showHidden = false, followLinks = true, absolutePath = true) => {
    filepath = path.resolve(filepath);
    if (sync) {
        try {
            // 如果是文件
            if (fileType(filepath) == 1) {
                return [filepath];
            }
            // 如果是链接文件 且不跟随 followLinks == false
            if (fileType(filepath) == 3 && !followLinks) {
                // console.log("所给的路径是链接。");
                return [filepath];
            } else if (fileType(filepath) == 3 && followLinks) {
                let tr = filepath = fileLinkedto(filepath)
                // 如果链接可用
                if (tr[1]) {
                    filepath = tr[0]
                } else {
                    return [filepath]
                }
            }
            // 接下来是目录处理
            let files = L.from(fs.readdirSync(filepath));
            // 如果不显示隐藏文件
            if (!showHidden) {
                files = L.filter((el) => {
                    if (el.substring(0, 1) == ".") {
                        return false;
                    } else {
                        return true;
                    }
                }, files);
            };
            // 返回绝对路径
            if (absolutePath) {
                let abFiles = L.empty();
                L.forEach((item) => {
                    item = path.join(filepath, item);
                    // 如果是链接, 且跟随链接
                    if (fileType(item) == 3 && followLinks) {
                        let lf;
                        try {
                            lf = fs.realpathSync(item);
                        } catch (error) {
                            console.log("ls: " + item + " 可能是损坏的链接文件");
                            lf = item;
                        }
                        abFiles = L.append(lf, abFiles);
                    } else {
                        abFiles = L.append(item, abFiles);
                    }
                }, files);
                return L.toArray(abFiles);
            } else {
                return L.toArray(files);
            }
        } catch (error) {
            console.log("ls:" + error);
        }
    } else {
        // 如果是文件
        if (fileType(filepath) == 1) {
            return [filepath];
        }
        // 如果是链接文件 且不跟随 followLinks == false
        if (fileType(filepath) == 3 && !followLinks) {
            // console.log("所给的路径是链接。");
            return [filepath];
        } else if (fileType(filepath) == 3 && followLinks) {
            try {
                filepath = fs.realpathSync(filepath);
            } catch (error) {
                console.log("ls: " + filepath + " 可能是损坏的链接文件");
                return [filepath];
            }
        }
        return fsPromise.readdir(filepath).then(x => {
            let files = L.from(x);
            if (!showHidden) {
                files = L.filter((el) => {
                    if (el.substring(0, 1) == ".") {
                        return false;
                    } else {
                        return true;
                    }
                }, files);
            };
            // 返回绝对路径
            if (absolutePath) {
                let abFiles = L.empty();
                L.forEach((item) => {
                    item = path.join(filepath, item);
                    // 如果是链接, 且跟随链接
                    if (fileType(item) == 3 && followLinks) {
                        let lf;
                        try {
                            lf = fs.realpathSync(item);
                        } catch (error) {
                            console.log("ls: " + item + " 可能是损坏的链接文件");
                            lf = item;
                        }
                        abFiles = L.append(lf, abFiles);
                    } else {
                        abFiles = L.append(item, abFiles);
                    }
                }, files);
                return L.toArray(abFiles);
            } else {
                return L.toArray(files);
            }
        });
    }
}


/**
 * 模拟la
 * @param {string} filepath  
 * @param {boolean} sync 
 * @param {boolean} followLinks 
 * @param {boolean} absolutePath 
 * @returns 
 */
export const la = (filepath, sync = true, followLinks = false, absolutePath = true) => {
    return ls(filepath, sync, true, followLinks, absolutePath);
}


/**
 * 返回给定扩展名的文件
 * @param {string} filepath 某个目录
 * @param {string} ext 扩展名
 * @returns 
 */
export const lsFileExtfilter = (filepath, ext) => {
    let fn = getExecFunction().name;
    if (fileType(filepath) != 2) {
        prompte("%s: 不是目录！", fn)
        return [];
    }
    try {
        let la_r = la(filepath);
        // prlst(la_r)
        let r_list = L.empty();
        la_r.forEach(el => {
            if (fileType(el) == 1 && path.extname(el) == "." + ext) {
                r_list = L.append(el, r_list);
            }
        });
        prlst(L.toArray(r_list))
        return L.toArray(r_list);
    } catch (error) {
        console.log("%s: " + error, fn);
    }
}


/**
 * 返回链接文件指向
 * @param {*} filepath 链接文件
 * @returns [链接地址， 链接好坏]
 */
export const fileLinkedto = (filepath) => {
    let flt = "";
    let flc = false;
    if (fileType(filepath) == 3) {
        try {
            fs.realpathSync(filepath);
            flc = true;
        } catch (error) {
            console.log("fileLinkedto: " + filepath + " 可能是损坏的链接文件");
            flc = false;
        }
        try {
            flt = fs.readlinkSync(filepath);
        } catch (error) {
            console.log("fileLinkedto: " + filepath + error);
        }
    }
    return [flt, flc];
}

/**
 * tree 返回目录下所有文件，包括空文件夹(包含当前文件夹) 仅有同步方法
 * @param {*} filepath 
 * @param {*} showHidden 
 * @param {*} followLinks  如果给定root是链接，则follow links
 * @returns 
 */
export const tree = (filepath, showHidden = false, followLinks = false) => {
    filepath = path.resolve(filepath);
    let tfs = L.empty();
    // 添加当前路径
    tfs = L.list(filepath);
    // 如果root是链接文件 直接跟随
    if (fileType(filepath) == 3) {
        // 获取链接地址
        let tr = fileLinkedto(filepath)
        if (tr[1]) {
            // 如果链接可用 则跟随到实际指向
            filepath = tr[0]
        } else {
            // 链接不可用，直接返回
            return [filepath]
        }
    }
    // 如果root是文件
    if (fileType(filepath) == 1) {
        return [filepath];
    }
    // root是空目录当作文件处理
    if (la(filepath).length == 0) {
        return [filepath];
    }
    // 其他情况(目录) ! 除非跟随链接, 目录中的链接不可以再使用tree
    try {
        // 获取目录下的子文件
        let root_dir = ls(filepath, true, showHidden, followLinks);
        root_dir.forEach(item => {
            let dup = false;
            // 检查有无重复
            L.toArray(tfs).forEach(el => {
                el = String(el);
                // 先检查源文件是否重复
                if (String(item) == el) {
                    prompt("tree: 重复项目(源文件): " + item, "e")
                    dup = true;
                }
                // 如果跟随链接，就检查链接实际指向有无重复
                // 如果是链接文件(前面检查没有重复de)
                if (fileType(item) == 3 && followLinks) {
                    if (String(fileLinkedto(item)[0]) == el) {
                        prompt("tree: 重复项目(链接文件 " + item + " 指向): " + fileLinkedto(item)[0], "e")
                        dup = true;
                    }
                }
            });
            // 文件没重复
            if (!dup) {
                // 如果是链接，且不跟随(因为直接使用tree读取链接默认第一级跟随),直接返回
                if (fileType(item) == 3 && !followLinks) {
                    tfs = L.append(item, tfs);
                } else {
                    // 不是链接
                    let rtfs = L.from(tree(item, showHidden, followLinks));
                    tfs = L.concat(rtfs, tfs);
                }
            }
        });
        // 过滤重复 
        return arrayRemoveDuplicates(L.toArray(tfs));
    } catch (error) {
        console.log(error);
    }
}
export const treeSync = (filepath, showHidden = false, followLinks = false) => {
    tree(filepath, showHidden, followLinks)
}


/**
 * 新建文件夹 注意Overwrite！会覆盖的！
 * @param {string} dir 路径 
 * @param {boolean} sync 是否同步
 * @param {boolean} overwrite 是否覆盖 会清空原有的
 * @param {boolean} recursive (mkdir -p ?)是否递归
 * @param {string} mode 文件权限默认"0700"
 * @returns null
 */
export const mkdir = (dir, sync = true, overwrite = false, recursive = false, mode = "0700") => {
    let fn = getExecFunction().name;
    if (fs.existsSync(dir)) {
        console.log("%s: 存在同名文件或者文件夹", fn);
        if (overwrite) {
            FD(dir);
        } else {
            return;
        }
    }
    if (sync) {
        try {
            fs.mkdirSync(dir, { recursive: recursive, mode: mode });
        } catch (error) {
            console.log("%s: " + error, fn);
        }
    } else {
        // 同意替换
        // fs.mkdir(dir, { recursive: recursive, mode: mode }, (err, data) => defaultCallback(err, data, name));
        // fsPromise.mkdir(dir, { recursive: recursive, mode: mode }).then(() => {
        //     callback[0]([fn]);
        // }).catch(() => {
        //     callback[1]([fn]);
        // });
        fsPromise.mkdir(dir, { recursive: recursive, mode: mode });
    }
}

/**
 * mkdir -p 注意Overwrite！会覆盖的！
 * @param {*} path 
 * @param {*} sync 
 * @param {*} overwrite 注意Overwrite！会覆盖的！
 * @param {*} mode 
 */
export const mkdirs = (path, sync = true, overwrite = false, mode = "0700") => {
    mkdir(path, sync, overwrite, true, mode);
}

/**
 * 删除文件
 * @param {string} filepath 
 * @param {boolean} sync 是否同步
 * @param {boolean} recursive 是否递归
 * @returns 
 */
export const rm = async (filepath, sync = true, recursive = false) => {
    let fn = getExecFunction().name;
    try {
        if (sync) {
            try {
                fs.rmSync(filepath, { recursive: recursive });
            } catch (error) {
                console.log(fn + ": " + error);
            }
        } else {
            return fsPromise.rm(filepath, { recursive: recursive });
        }
    } catch (error) {
        console.log(error);
    }
}
/**
 * 清空目录
 * @param {*} dir 目录
 * @param {*} sync 是否同步
 * @returns 
 */
export const rmClearDirectory = async (dir, sync = true) => {
    let fn = getExecFunction().name;
    // 判断是不是目录
    if (fileType(dir) != 2) {
        prompte(fn + ": " + dir + "不是目录！")
        return;
    }
    try {
        if (sync) {
            try {
                // 列出文件
                let dfiles = la(dir);
                dfiles.forEach(el => {
                    rm(el, sync, true);
                });
            } catch (error) {
                console.log(fn + ": " + error);
            }
        } else {
            la(dir, false).then((files) => {
                files.forEach(el => {
                    rm(el, sync, true);
                });
            });
        }
    } catch (error) {
        console.log(error);
    }
}
/**
 * 删除文件或者文件夹
 * @param {*} filepath 路径
 * @param {*} sync 是否同步
 * @returns 
 */
export const rmFD = async (filepath, sync = true) => {
    let fn = getExecFunction().name;
    if (sync) {
        try {
            return rm(filepath, sync, true);
        } catch (error) {
            console.log(fn + ": " + error);
            return undefined;
        }
    } else {
        rm(filepath, sync, true);
    }
}


/**
 * 复制文件
 * 如果recursive是false，除了src dst，其他Option选项无效
 * @param {string} src 
 * @param {string} dst 
 * @param {boolean} sync 是否同步
 * @param {boolean} recursive 是则可以复制目录
 * @param {boolean} overwrite 覆盖现有文件或目录，默认为 true。 请注意，如果将其设置为，复制操作将默默失败 false并且目的地存在。 使用 errorOnExist更改此行为的选项。 
 * @param {boolean} errorOnExist  什么时候 overwrite是 false并且目的地存在，抛出错误。 默认为 false. 
 * @param {boolean} dereference 取消引用符号链接，默认为 false. 
 * @param {boolean} preserveTimestamps 为 true 时，会将上次修改和访问时间设置为原始源文件的时间。 当为 false 时，时间戳行为取决于操作系统。 默认为 false. 
 * @param {Function} filter 过滤复制文件/目录的功能。 返回 true要复制该项目， false忽略它。 
 */
export const cp = (src, dst, sync = true, recursive = false,
    overwrite = true, errorOnExist = false,
    dereference = false, preserveTimestamps = false,
    filter = (src, dest) => {
        return true;
    }) => {
    let fn = getExecFunction().name;
    let result = false;
    if (sync) {
        try {
            if (recursive) {
                // 请注意，如果 src是一个目录，它将复制该目录内的所有内容，而不是整个目录本身
                //（请参阅 问题＃537 https://github.com/jprichardson/node-fs-extra/issues/537 ）。 
                fse.copySync(src, dst, {
                    overwrite: overwrite,
                    errorOnExist: errorOnExist,
                    dereference: dereference,
                    preserveTimestamps: preserveTimestamps,
                    filter: filter
                });
                result = true;
            } else {
                fs.copyFileSync(src, dst);
                result = true;
            }
        } catch (error) {
            console.log("%s: " + error, fn);
            result = false;
        }
        return result;
    } else {
        if (recursive) {
            // 请注意，如果 src是一个目录，它将复制该目录内的所有内容，而不是整个目录本身
            //（请参阅 问题＃537 https://github.com/jprichardson/node-fs-extra/issues/537 ）。 
            fse.copySync(src, dst, {
                overwrite: overwrite,
                errorOnExist: errorOnExist,
                dereference: dereference,
                preserveTimestamps: preserveTimestamps,
                filter: filter
            });
            fse.copy()
        } else {
            fs.copyFile(src, dst);
        }
    }
}


/**
 * 复制文件、文件夹
 * @param {string} src 
 * @param {string} dst 
 * @param {boolean} sync 是否同步
 * @param {boolean} overwrite 覆盖现有文件或目录，默认为 true。 请注意，如果将其设置为，复制操作将默默失败 false并且目的地存在。 使用 errorOnExist更改此行为的选项。 
 * @param {boolean} errorOnExist  什么时候 overwrite是 false并且目的地存在，抛出错误。 默认为 false. 
 * @param {boolean} dereference 取消引用符号链接，默认为 false. 
 * @param {boolean} preserveTimestamps 为 true 时，会将上次修改和访问时间设置为原始源文件的时间。 当为 false 时，时间戳行为取决于操作系统。 默认为 false. 
 * @param {Function} filter 过滤复制文件/目录的功能。 返回 true要复制该项目， false忽略它。 
 */
export const cpFD = (src, dst, sync = true,
    overwrite = true, errorOnExist = false,
    dereference = false, preserveTimestamps = false,
    filter = (s, d) => {
        return true;
    }) => {
    return cp(src, dst,
        sync, true,
        overwrite, errorOnExist,
        dereference, preserveTimestamps,
        filter)
}


/**
 * 移动文件（重命名）
 * @param {string} src 源
 * @param {string} dst 目的
 * @param {boolean} sync 是否同步
 * @returns 
 */
export const mv = (src, dst, sync = true) => {
    let fn = getExecFunction().name;
    let result = false;
    if (sync) {
        try {
            fs.renameSync(src, dst);
            result = true;
        } catch (error) {
            console.log("%s: " + error, fn);
            result = false;
        }
        return result;
    } else {
        fsPromise.rename(src, dst);
    }
}


/**
 * 先复制再删除
 * 如果recursive是false，除了src dst，其他Option选项无效
 * @param {string} src 
 * @param {string} dst 
 * @param {boolean} overwrite 覆盖现有文件或目录，默认为 true。 请注意，如果将其设置为，复制操作将默默失败 false并且目的地存在。 使用 errorOnExist更改此行为的选项。 
 * @param {boolean} errorOnExist  什么时候 overwrite是 false并且目的地存在，抛出错误。 默认为 false. 
 * @param {boolean} dereference 取消引用符号链接，默认为 false. 
 * @param {boolean} preserveTimestamps 为 true 时，会将上次修改和访问时间设置为原始源文件的时间。 当为 false 时，时间戳行为取决于操作系统。 默认为 false. 
 * @param {Function} filter 过滤复制文件/目录的功能。 返回 true要复制该项目， false忽略它。 
 */
export const mvCPRM = (src, dst,
    overwrite = true, errorOnExist = false,
    dereference = false, preserveTimestamps = false,
    filter = (s, d) => {
        return true;
    }) => {
    let fn = getExecFunction().name;
    try {
        if (cp(src, dst,
            true, true,
            overwrite, errorOnExist,
            dereference, preserveTimestamps,
            filter)) {
            rmFD(src);
        } else {
            prompte("%s: 复制文件似乎出错了", fn)
        }
    } catch (error) {
        console.log("%s: " + error, fn);
    }
}


/**
 * 读取文件内容
 * @param {*} filepath 文件路径
 * @param {*} readFile 使用ReadFile还是read   true
 * @param {*} sync 是否同步  true
 * @param {*} encoding 编码默认'utf-8' 可设置为 null buffer
 * @param {*} fsopenflag 默认'r'
 * @param {*} callback 异步回调
 * @param {*} fsopenmode 默认 0o666
 * @param {*} fsreadoffset 缓冲区中的偏移量，指示从哪里开始写入。仅对read方法有效
 * @param {*} fsreadbufflength 缓冲区长度，仅对read方法有效
 * @param {*} fsreadlength 一个整数，指定要读取的字节数。，仅对read方法有效
 * @param {*} fsreadposition null 一个整数，指定从文件中的何处开始读取。 如果位置为空，则从当前文件位置读取数据。 ，仅对read方法有效
 * @returns 
 */
export const readFileContent = (filepath, readFile = true, sync = true, encoding = 'utf-8',
    fsopenflag = 'r', callback = undefined, fsopenmode = 0o666,
    fsreadoffset = 0, fsreadbufflength = 0, fsreadlength = undefined, fsreadposition = null) => {
    if (fsreadbufflength == 0) {
        // 文件大小即是缓冲大小
        let fps = fs.statSync(filepath);
        fsreadbufflength = fps.size;
    }
    let buf = new Buffer.alloc(fsreadbufflength);
    if (fsreadlength == undefined) {
        fsreadlength = buf.byteLength;
    }
    let fn = getExecFunction().name;
    let content = "";
    try {
        if (sync) {
            // 同步读取
            try {
                if (readFile) {
                    let data = fs.readFileSync(filepath, { encoding: encoding });
                    content = data;
                } else {
                    // 使用read
                    /**
fs.open()方法返回的文件描述符。
buffer： 存储从文件中取出的数据。
offset： 缓冲区中的偏移量，指示从哪里开始写入。
length： 一个整数，指定要读取的字节数。
位置： 一个整数，指定从文件中的何处开始读取。 如果位置为空，则从当前文件位置读取数据。 
                     */
                    let f = fs.openSync(filepath, fsopenflag, fsopenmode);
                    let d = fs.readSync(f, buf, fsreadoffset, fsreadlength, fsreadposition);
                    console.log(d + "  字节被读取");
                    // 仅输出读取的字节
                    if (d > 0) {
                        content = buf.slice(0, d).toString()
                        console.log(content);
                    }
                }
                console.log("readFileContent:同步读取: " + content);
                return content;
            } catch (error) {
                prompte(fn + ": " + error);
                return undefined;
            }
        } else {
            // 异步读取
            if (callback == undefined) {
                callback = (error, data) => {
                    if (error) {
                        console.log(error);//error输出的是错误对象信息
                        console.log('%s: 读取文件失败', fn);
                    } else {
                        console.log(data);
                        return data;
                    }
                }
            }
            if (readFile) {
                let data = fs.readFile(filepath, { encoding: encoding }, callback);
                content = data;
            } else {
                fs.open(filepath, fsopenflag, fsopenmode, function (err, fd) {
                    if (err) {
                        return console.error(err);
                    }
                    fs.read(fd, buf, fsreadoffset, fsreadlength, fsreadposition,
                        function (err, bytes) {
                            if (err) {
                                console.log(err);
                            }
                            // 仅输出读取的字节
                            if (bytes > 0) {
                                content = buf.slice(0, bytes).toString();
                                console.log(content);
                            }
                            console.log(bytes + " bytes read");

                            // Close the opened file.
                            fs.close(fd, function (err) {
                                if (err) {
                                    console.log(err);
                                }
                                console.log("File closed successfully");
                            });
                            return content;
                        });
                });
            }
            console.log("readFileContent:异步读取: " + content);
        }
    } catch (error) {
        console.log("readFileContent:" + error);
    }
    return content;
}


/**
 * 读取大文件 返回每行的数组
 * npm install n-readlines
 * @param {*} filepath 文件
 * @param {*} splitor 每一行的分隔符， 也就是行再分隔
 * @param {*} code_comment 代码注释标志
 * @param {*} sync 是否同步
 * @param {*} encoding 默认 utf-8
 * @param {*} ignoreNull 忽略空行
 * @returns 数组
 */
export const readFileNReadlines = (filepath, splitor = undefined, code_comment = undefined, sync = true, encoding = "utf-8", ignoreNull = true) => {
    let fn = getExecFunction().name;
    if (sync) {
        try {
            let readLines = L.empty();
            const liner = new lineByLine(filepath);
            let line;
            let lineNumber = 0;
            while (line = liner.next()) {
                line = line.toString(encoding).replace("\r\n", "").replace("\r", "").replace("\n", "");
                if (ignoreNull && line == "") {
                    // promptw("发现空行! ");
                    lineNumber++;
                    continue;
                }
                // 如果定义了忽略的字符串
                if (code_comment != undefined) {
                    // 行里有注释符号
                    if (line.indexOf(code_comment) != -1) {
                        // 分隔，取前面
                        let tsp = line.split(code_comment);
                        // 取开头
                        tsp = String(tsp[0]).replace(" ", "").replace("\t", "");
                        // 去除空格和Tab后是空则为注释
                        if (tsp === "") {
                            // promptw("发现注释:  "+line);
                            lineNumber++;
                            continue;
                        }
                    }
                }
                // 如果定义了分隔符
                if (splitor != undefined) {
                    if (line.indexOf(splitor) == -1) {
                        // 不包含就是[line内容]
                        readLines = L.append([line], readLines);
                    } else {
                        readLines = L.append(line.split(splitor), readLines);
                    }
                } else {
                    readLines = L.append(line, readLines);
                }
                // console.log('Line ' + lineNumber + ': ' + line);
                lineNumber++;
            }
            // console.log('end of line reached');
            return L.toArray(readLines);
        } catch (error) {
            console.log("%s: " + error, fn);
            return undefined;
        }
    } else {
        let readLines = L.empty();
        let rl = readline.createInterface({
            input: fs.createReadStream(filepath),
            output: process.stdout,
            terminal: false
        });

        rl.on('line', (line) => {
            let pass = false;
            line = line.toString(encoding);
            promptm(line);
            if (ignoreNull && line == "") {
                // promptw("发现空行! ");
                pass = true;
            }
            // 如果定义了忽略的字符串
            if (code_comment != undefined) {
                // 行里有注释符号
                if (line.indexOf(code_comment) != -1) {
                    // 分隔，取前面
                    let tsp = line.split(code_comment);
                    // 取开头
                    tsp = String(tsp[0]).replace(" ", "").replace("\t", "");
                    // 去除空格和Tab后是空则为注释
                    if (tsp === "") {
                        // promptw("发现注释:  " + line);
                        pass = true;
                    }
                }
            }
            if (!pass) {
                // 如果定义了分隔符
                if (splitor != undefined) {
                    if (line.indexOf(splitor) == -1) {
                        // 不包含就是[line内容]
                        readLines = L.append([line], readLines);
                    } else {
                        readLines = L.append(line.split(splitor), readLines);
                    }
                } else {
                    readLines = L.append(line, readLines);
                }
            }
        });

        rl.on('close', function () {
            // do something on finish here
            return L.toArray(readLines);
        });
    }
}

/**
 * 默认配置文件设置
 * @param {*} filepath 
 * @param {*} splitor 
 * @param {*} code_comment 
 */
export const readConfFileSync = (filepath, splitor = "=", code_comment = "#") => {
    return readFileNReadlines(filepath, splitor, code_comment);
}


/**
 * 写入文件
 * @param {string} filepath 
 * @param {*} towrite 
 * @param {*} sync 
 * @param {*} encoding 
 * @param {*} flag 
 * @param {*} overwrite 
 * @param {*} mode 
 * @returns 
 */
export const writeFileContent = (filepath, towrite, sync = true, encoding = "utf-8", flag = "w", overwrite = true, mode = 0o666) => {
    let fn = getExecFunction().name;
    if (fs.existsSync(filepath) && !overwrite) {
        prompte(fn + ": 文件存在 => " + filepath);
        return undefined;
    }
    if (sync) {
        try {
            fs.writeFileSync(filepath, towrite, { encoding: encoding, flag: flag, mode: mode });
        } catch (error) {
            console.log("%s: " + error, fn);
        }
    } else {
        fs.writeFile(filepath, towrite, { encoding: encoding, flag: flag, mode: mode }, err => {
            if (err) {
                console.error(err);
                return undefined;
            }
            // file written successfully
        });
    }
}

/**
 * 追加写入
 * @param {*} filepath 
 * @param {*} towrite 
 * @param {*} sync 
 * @param {*} encoding 
 * @param {*} overwrite 
 * @param {*} mode 
 */
export const writeFileInAppendMode = (filepath, towrite, sync = true, encoding = "utf-8", overwrite = true, mode = 0o666) => {
    let flag = "a";
    writeFileContent(filepath, towrite, sync, encoding, flag, overwrite, mode);
}


/**
 * 逐行写入（仅异步）
 * EOL 换行符默认windows的
 * @param {*} filepath 
 * @param {Array} linesToWrite  
 * @param {*} flags 
 * @param {*} encoding 
 * @param {*} EOL 换行符默认windows的
 * @param {*} overwrite 
 * @returns 
 */
export const writeByLinesAsync = (filepath, linesToWrite, flags = "w", encoding = "utf-8", EOL = "\r\n", overwrite = true) => {
    let fn = getExecFunction().name;
    if (fs.existsSync(filepath) && !overwrite) {
        prompte(fn + ": 文件存在 => " + filepath);
        return undefined;
    }
    if (EOL == undefined) {
        EOL = os.EOL;
    }
    // 创建一个可以写入的流，写入到文件 output.txt 中
    let writerStream = fs.createWriteStream(filepath, { flags: flags, encoding: encoding });

    linesToWrite.forEach(l => {
        // 使用 utf8 编码写入数据
        writerStream.write(l + EOL, encoding);
    });

    // 标记文件末尾
    writerStream.end();

    // 处理流事件 --> finish、error
    writerStream.on('finish', function () {
        console.log("写入完成。");
        writerStream.close();
    });

    writerStream.on('error', function (err) {
        console.log(err.stack);
    });
}


/**
 * 设置延时 
 * 使用: await sleep(xxxx);
 * import {setTimeout} from 'node:timers/promises'; 
 * @param {*} msecond 毫秒
 */
export const sleep = async (msecond) => {
    if (msecond % 1000 == 0) {
        let sec = msecond / 1000;
        for (let i = sec; i > 0; i--) {
            promptm("还有 " + i + " 秒");
            await setTimeout(1000);
        }
    } else {
        await setTimeout(msecond);
    }
    promptm("Done.");
}


/**
 * 返回本机IP地址
 * @param {Number} type 0:全部 1:ipv4 2:ipv6
 * @returns 
 */
export const getIpAddr = (type=0) => {
    // 获取本机网络信息
    let iaddr = L.empty();
    const nfs = os.networkInterfaces();
    // console.log(nfs);
    // 查找 IPv4 地址
    for (const networkname in nfs) {
        // 网络名称
        // console.log(networkname);
        for (const v4v6 of nfs[networkname]) {
            // 打印IPv4 IPv6网络信息
            // console.log(v4v6);
            if (type == 1){
                if (v4v6.family === 'IPv4') {
                    iaddr = L.append(v4v6.address, iaddr);
                    break
                }
            }
            else if (type == 2){
                if (v4v6.family === 'IPv6') {
                    iaddr = L.append(v4v6.address, iaddr);
                    break
                }
            }else{
                iaddr = L.append(v4v6.address, iaddr);
            }
        }
    }
    // prlst(L.toArray(iaddr));
    return L.toArray(iaddr);
}
