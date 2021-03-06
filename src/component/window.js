
import { b64encode, b64decode, memoize, uniqueID } from '../lib';
import { XCOMPONENT } from '../constants';


/*  Build Child Window Name
    -----------------------

    Build a name for our child window. This should identify the following things to the child:

    - That the window was created by, and is owned by xcomponent
    - The name of the child's parent. This is so the child can identify which window created it, even when we do a
      renderToParent, in which case the true parent may actually be a sibling frame in the window hierarchy

    We base64 encode the window name so IE doesn't die when it encounters any characters that it doesn't like.
*/

export function buildChildWindowName(prefix, options = {}) {

    options.id = uniqueID();
    let name = b64encode(JSON.stringify(options));

    return `${XCOMPONENT}_${prefix.replace(/_/g, '')}_${name}`;
}


/*  Parse Window Name
    -----------------

    The inverse of buildChildWindowName. Base64 decodes and json parses the window name to get the original props
    passed down, including the parent name. Only accepts window names built by xcomponent
*/

export let getComponentMeta = memoize(() => {

    if (!window.name) {
        return;
    }

    let segments = window.name.split('_');
    let options = segments.slice(2).join('_');

    if (segments[0] !== XCOMPONENT) {
        return;
    }

    try {
        return JSON.parse(b64decode(options));
    } catch (err) {
        return;
    }
});


export let isXComponentWindow = memoize(() => {
    return Boolean(getComponentMeta());
});


export let getParentWindow = memoize(() => {

    let parentWindow;

    if (window.opener) {
        parentWindow = window.opener;
    } else if (window.parent && window.parent !== window) {
        parentWindow = window.parent;
    } else {
        throw new Error(`Can not find parent window`);
    }

    let componentMeta = getComponentMeta();

    if (!componentMeta) {
        return parentWindow;
    }

    if (!parentWindow.parent || parentWindow.parent === parentWindow) {
        return parentWindow;
    }

    if (componentMeta.sibling && parentWindow.parent.frames && parentWindow.parent.frames[componentMeta.parent] === parentWindow) {
        return parentWindow.parent;
    }

    return parentWindow;
});



/*  Get Parent Component Window
    ---------------------------

    Get the parent component window, which may be different from the actual parent window
*/

export let getParentComponentWindow = memoize(() => {

    // Get properties from the window name, passed down from our parent component

    let componentMeta = getComponentMeta();

    if (!componentMeta) {
        throw new Error(`Can not get parent component window - window not rendered by xcomponent`);
    }

    let parentWindow = getParentWindow();

    // Use this to infer which window is our true 'parent component'. This can either be:
    //
    // - Our actual parent
    // - A sibling which rendered us using renderToParent()

    if (componentMeta.sibling && parentWindow.frames[componentMeta.parent]) {
        return parentWindow.frames[componentMeta.parent];
    }

    return parentWindow;
});


/*  Get Position
    ------------

    Calculate the position for the popup / lightbox

    This is either
    - Specified by the user
    - The center of the screen

    I'd love to do this with pure css, but alas... popup windows :(
*/

export function getPosition(options) {

    let left;
    let top;
    let width = options.width;
    let height = options.height;

    if (window.outerWidth) {
        left = Math.round((window.outerWidth - width) / 2) + window.screenX;
        top = Math.round((window.outerHeight - height) / 2) + window.screenY;
    } else if (window.screen.width) {
        left = Math.round((window.screen.width - width) / 2);
        top = Math.round((window.screen.height - height) / 2);
    }

    return {
        x: left,
        y: top
    };
}