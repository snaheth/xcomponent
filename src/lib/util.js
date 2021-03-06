
import base64 from 'Base64';


/*  Url Encode
    ----------

    Replace ? and & with encoded values. Allows other values (to create more readable urls than encodeUriComponent)
*/

export function urlEncode(str) {
    return str.replace(/\?/g, '%3F').replace(/\&/g, '%26');
}


/*  Camel To Dasherize
    ------------------

    Convert camelCaseText to dasherized-text
*/

export function camelToDasherize(string) {
    return string.replace(/([A-Z])/g, (g) => {
        return `-${g.toLowerCase()}`;
    });
}


/*  Dasherize to Camel
    ------------------

    Convert dasherized-text to camelCaseText
*/

export function dasherizeToCamel(string) {
    return string.replace(/-([a-z])/g, (g) => {
        return g[1].toUpperCase();
    });
}


/*  Extend
    ------

    Extend one object with another
*/

export function extend(obj, source) {
    if (!source) {
        return obj;
    }

    for (let key in source) {
        if (source.hasOwnProperty(key)) {
            obj[key] = source[key];
        }
    }

    return obj;
}


/*  Values
    ------

    Get all of the values from an object as an array
*/

export function values(obj) {
    let results = [];

    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            results.push(obj[key]);
        }
    }

    return results;
}


/*  Unique ID
    ---------

    Generate a unique, random hex id
*/

export function uniqueID() {

    let chars = '0123456789abcdef';

    return 'xxxxxxxxxx'.replace(/./g, () => {
        return chars.charAt(Math.floor(Math.random() * chars.length));
    });
}


/*  Base 64 Encode
    --------------

    Base 64 encode a string
*/

export function b64encode(str) {
    return (window.btoa ? window.btoa(str) : base64.btoa(str)).replace(/[=]/g, '_');
}


/*  Base 64 Decode
    --------------

    Base 64 decode a string
*/

export function b64decode(str) {
    str = str.replace(/[_]/g, '=');
    return (window.atob ? window.atob(str) : base64.atob(str));
}


/*  Stringify with Functions
    ------------------------

    JSON Stringify with added support for functions
*/

export function stringifyWithFunctions(obj) {
    return JSON.stringify(obj, (key, val) => {
        if (typeof val === 'function') {
            return val.toString();
        }
        return val;
    });
}


/*  Safe Get
    --------

    Get a property without throwing error
*/

export function safeGet(obj, prop) {

    let result;

    try {
        result = obj[prop];
    } catch (err) {
        // pass
    }

    return result;
}


/* Capitalize First Letter
   -----------------------
*/

export function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}


/*  Get
    ---

    Recursively gets a deep path from an object, returning a default value if any level is not found
*/

export function get(item, path, def) {

    if (!path) {
        return def;
    }

    path = path.split('.');

    // Loop through each section of our key path

    for (let i = 0; i < path.length; i++) {

        // If we have an object, we can get the key

        if (typeof item === 'object' && item !== null) {
            item = item[path[i]];

        // Otherwise, we should return the default (undefined if not provided)
        } else {
            return def;
        }
    }

    // If our final result is undefined, we should return the default

    return item === undefined ? def : item;
}


/*  Safe Interval
    -------------

    Implement setInterval using setTimeout, to avoid stacking up calls from setInterval
*/

export function safeInterval(method, time) {

    let timeout;

    function runInterval() {
        timeout = setTimeout(runInterval, time);
        method.call();
    }

    timeout = setTimeout(runInterval, time);

    return {
        cancel() {
            clearTimeout(timeout);
        }
    };
}

/*  Safe Interval
    -------------

    Run timeouts at 100ms intervals so we can account for busy browsers
*/

export function safeTimeout(method, time) {

    let interval = safeInterval(() => {
        time -= 100;
        if (time <= 0) {
            interval.cancel();
            method();
        }
    }, 100);
}