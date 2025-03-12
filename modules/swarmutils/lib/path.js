function replaceAll(str, search, replacement) {
    return str.split(search).join(replacement);
}

function resolvePath(pth) {
    let pathSegments = pth.split("/");
    let makeAbsolute = pathSegments[0] === "" ? true : false;
    for (let i = 0; i < pathSegments.length; i++) {
        let segment = pathSegments[i];
        if (segment === "..") {
            let j = 1;
            if (i > 0) {
                j = j + 1;
            }
            // else {
            //     makeAbsolute = true;
            // }
            pathSegments.splice(i + 1 - j, j);
            i = i - j;
        }
    }
    let res = pathSegments.join("/");
    if (makeAbsolute && res !== "") {
        res = __ensureIsAbsolute(res);
    }
    return res;
}

function normalize(pth) {
    if (typeof pth !== "string") {
        throw new TypeError();
    }
    pth = replaceAll(pth, "\\", "/");
    pth = replaceAll(pth, /[/]+/, "/");

    return resolvePath(pth);
}

function join(...args) {
    let pth = "";
    for (let i = 0; i < args.length; i++) {
        if (i !== 0 && args[i - 1] !== "") {
            pth += "/";
        }

        pth += args[i];
    }

    return normalize(pth);
}

function __ensureIsAbsolute(pth) {
    if (pth[0] !== "/") {
        pth = "/" + pth;
    }
    return pth;
}

function isAbsolute(pth) {
    pth = normalize(pth);
    //on windows ":" is used as separator after partition ID
    if (pth[0] !== "/" && pth[1] !== ":") {
        return false;
    }

    return true;
}

function ensureIsAbsolute(pth) {
    pth = normalize(pth);
    return __ensureIsAbsolute(pth);
}

function isSubpath(path, subPath) {
    path = normalize(path);
    subPath = normalize(subPath);
    let result = false;
    if (path.indexOf(subPath) === 0) {
        let char = path[subPath.length];
        if (char === "" || char === "/" || subPath === "/") {
            result = true;
        }
    }

    return result;
}

function dirname(path) {
    if (path === "/") {
        return path;
    }
    const pathSegments = path.split("/");
    pathSegments.pop();
    return ensureIsAbsolute(pathSegments.join("/"));
}

function basename(path) {
    if (path === "/") {
        return path;
    }
    return path.split("/").pop;
}

function relative(from, to) {
    from = normalize(from);
    to = normalize(to);

    const fromSegments = from.split("/");
    const toSegments = to.split("/");
    let splitIndex;
    for (let i = 0; i < fromSegments.length; i++) {
        if (fromSegments[i] !== toSegments[i]) {
            break;
        }
        splitIndex = i;
    }

    if (typeof splitIndex === "undefined") {
        throw Error(`The paths <${from}> and <${to}> have nothing in common`);
    }

    splitIndex++;
    let relativePath = [];
    for (let i = splitIndex; i < fromSegments.length; i++) {
        relativePath.push("..");
    }
    for (let i = splitIndex; i < toSegments.length; i++) {
        relativePath.push(toSegments[i]);
    }

    return relativePath.join("/");
}

function resolve(...pathArr) {
    function __resolvePathRecursively(currentPath) {
        let lastSegment = pathArr.pop();
        if (typeof currentPath === "undefined") {
            currentPath = lastSegment;
        } else {
            currentPath = join(lastSegment, currentPath);
        }
        if (isAbsolute(currentPath)) {
            return currentPath;
        }

        if (pathArr.length === 0) {
            let cwd;
            try {
                cwd = process.cwd();
            } catch (e) {
                cwd = "/";
            }

            return join(cwd, currentPath);
        }

        return __resolvePathRecursively(currentPath);
    }

    return __resolvePathRecursively();
}

function extname(path) {
    path = resolvePath(path);
    let ext = path.match(/\.[0-9a-z]+$/i);
    if (Array.isArray(ext)) {
        ext = ext[0];
    } else {
        ext = "";
    }
    return ext;
}

module.exports = {
    normalize,
    join,
    isAbsolute,
    ensureIsAbsolute,
    isSubpath,
    dirname,
    basename,
    relative,
    resolve,
    extname
};
