
import postRobot from 'post-robot/src';
import { SyncPromise as Promise } from 'sync-browser-mocks/src/promise';
import { BaseComponent } from '../base';
import { getParentComponentWindow, getParentWindow, getComponentMeta, isXComponentWindow } from '../window';
import { noop, extend, onCloseWindow, addEventListener } from '../../lib';
import { POST_MESSAGE, CONTEXT_TYPES, CLOSE_REASONS } from '../../constants';
import { normalizeProps } from '../props';
import { normalizeChildProps } from './props';

/*  Child Component
    ---------------

    This is the portion of code which runs inside the frame or popup window containing the component's implementation.

    When the component author calls myComponent.attach(), it creates a new instance of ChildComponent, which is then
    responsible for managing the state and messaging back up to the parent, and providing props for the component to
    utilize.
*/

export class ChildComponent extends BaseComponent {

    constructor(component, options = {}) {
        super(component, options);
        this.component = component;

        this.component.log(`construct_child`);

        this.validate(options);

        // Handlers for various component lifecycle events

        this.onEnter = this.tryCatch(options.onEnter || noop);
        this.onClose = this.tryCatch(options.onClose || noop);
        this.onProps = this.tryCatch(options.onProps || noop, false);
        this.onError = this.tryCatch(options.onError || (err => { throw err; }));

        // The child can specify some default props if none are passed from the parent. This often makes integrations
        // a little more seamless, as applicaiton code can call props.foo() without worrying about whether the parent
        // has provided them or not, and fall-back to some default behavior.

        this.setProps(normalizeProps(this.component, this, options.defaultProps || {}), false);

        // We support a 'standalone' mode where the child isn't actually created by xcomponent. This may be because
        // there's an existing full-page implementation which uses redirects. In this case, the user can specify
        // standalone: true, and defaultProps, and the child component should continue to function in the same way
        // as if it were created by xcomponent, with the exception that no post-messages will ever be sent.

        this.standalone = options.standalone;
    }

    /*  Init
        ----

        Message up to the parent to let them know we've rendered successfully, and get some initial data and props
    */

    init() {

        this.component.log(`init_child`);

        // In standalone mode, we would expect setWindows to fail since there is no parent window and window.name
        // will not be generated by xcomponent. In this case we can fail silently, whereas normally we'd want to
        // fail hard here.

        if (!isXComponentWindow() && this.standalone) {
            this.component.log(`child_standalone`);
            return;
        }

        this.setWindows();

        // In standalone mode, there's no point messaging back up to our parent -- because we have none. :'(

        if (this.standalone && !getParentWindow()) {
            return Promise.resolve();
        }

        if (this.component.autoResize) {
            this.watchForResize();
        }

        // Send an init message to our parent. This gives us an initial set of data to use that we can use to function.
        //
        // For example:
        //
        // - What context are we
        // - What props has the parent specified

        return this.sendToParent(POST_MESSAGE.INIT, {

            exports: this.exports()

        }).then(data => {

            this.context = data.context;
            this.setProps(data.props);

            this.onEnter.call(this);

        }).catch(err => this.onError(err));
    }


    setProps(props = {}, onProps = true) {
        this.props = this.props || {};
        extend(this.props, normalizeChildProps(this.component, props));

        if (onProps) {
            this.onProps.call(this);
        }
    }


    /*  Send to Parent
        --------------

        Send a post message to our parent window.
    */

    sendToParent(name, data) {
        this.component.log(`send_to_parent_${name}`);
        return postRobot.send(getParentWindow(), name, data);
    }


    /*  Set Windows
        -----------

        Determine the parent window, and the parent component window. Note -- these may be different, if we were
        rendered using renderToParent.
    */

    setWindows() {


        // Ensure we do not try to .attach() multiple times for the same component on the same page

        if (window.__activeXComponent__) {
            throw new Error(`[${this.component.tag}] Can not attach multiple components to the same window`);
        }

        window.__activeXComponent__ = this;

        // Get the direct parent window

        if (!getParentWindow()) {
            throw new Error(`[${this.component.tag}] Can not find parent window`);
        }

        let componentMeta = getComponentMeta();

        if (componentMeta.tag !== this.component.tag) {
            throw new Error(`[${this.component.tag}] Parent is ${componentMeta.tag} - can not attach ${this.component.tag}`);
        }

        // Note -- getting references to other windows is probably one of the hardest things to do. There's basically
        // only a few ways of doing it:
        //
        // - The window is a direct parent, in which case you can use window.parent or window.opener
        // - The window is an iframe owned by you or one of your parents, in which case you can use window.frames
        // - The window sent you a post-message, in which case you can use event.source
        //
        // If we didn't rely on winProps.parent here from the window name, we'd have to relay all of our messages through
        // our actual parent. Which is no fun at all, and pretty error prone even with the help of post-robot. So this
        // is the lesser of two evils until browsers give us something like getWindowByName(...)

        // If the parent window closes, we need to close ourselves. There's no point continuing to run our component
        // if there's no parent to message to.

        this.watchForClose();
    }


    /*  Watch For Close
        ---------------

        Watch both the parent window and the parent component window, if they close, close this window too.
    */

    watchForClose() {

        onCloseWindow(getParentWindow, () => {

            this.component.log(`parent_window_closed`);

            this.onClose(CLOSE_REASONS.PARENT_CLOSE_DETECTED);

            // We only need to close ourselves if we're a popup -- otherwise our parent window closing will automatically
            // close us, if we're an iframe

            if (this.context === CONTEXT_TYPES.POPUP) {
                this.destroy();
            }
        });

        // Only listen for parent component window if it's actually a different window

        if (getParentComponentWindow() && getParentComponentWindow() !== getParentWindow()) {
            onCloseWindow(getParentComponentWindow(), () => {

                this.component.log(`parent_component_window_closed`);

                // We do actually need to close ourselves in this case, even if we're an iframe, because our component
                // window is probably a sibling and we'll remain open by default.

                this.close(CLOSE_REASONS.PARENT_CLOSE_DETECTED);
            });
        }

        addEventListener(window, 'beforeunload', () => this.onClose());
    }


    /*  Validate
        --------

        Validate any options passed in to ChildComponent
    */

    validate(options) {

        // TODO: Implement this
    }

    watchForResize() {
        let body = document.body;

        if (!body) {
            return;
        }

        let lastWidth = body.scrollWidth;
        let newWidth;
        let lastHeight = body.scrollHeight;
        let newHeight;

        body.addEventListener('scroll', function() {
            newWidth = body.scrollWidth;
            newHeight = body.scrollHeight;

            // Dimensions changed if this condition is true
            if (lastHeight !== newHeight || lastWidth !== newWidth) {
                this.resize(newWidth, newHeight);
            }
            lastWidth = newWidth;
            lastHeight = newHeight;
        }, false);
    }

    exports() {

        return {
            updateProps: props => this.setProps(props),
            close: () => window.close()
        };
    }


    /*  Resize
        ------

        Resize the child window. Must be done on a user action like a click if we're in a popup
    */

    resize(width, height) {
        return Promise.resolve().then(() => {

            this.component.log(`resize`, { width, height });

            if (this.context === CONTEXT_TYPES.POPUP) {
                return window.resizeTo(width, height);
            }

            return this.sendToParent(POST_MESSAGE.RESIZE, { width, height });
        });
    }


    /*  Hide
        ----

        Hide the window and any parent template
    */

    hide() {
        return this.sendToParent(POST_MESSAGE.HIDE);
    }



    userClose() {
        return this.close(CLOSE_REASONS.USER_CLOSED);
    }


    /*  Close
        -----

        Close the child window
    */

    close(reason = CLOSE_REASONS.CHILD_CALL) {

        this.component.log(`close_child`);

        this.onClose.call(this, reason);

        // Ask our parent window to close us

        this.sendToParent(POST_MESSAGE.CLOSE, { reason }, {
            fireAndForget: true
        });
    }


    destroy() {
        window.close();
    }


    /*  Focus
        -----

        Focus the child window. Must be done on a user action like a click
    */

    focus() {
        this.component.log(`focus`);

        window.focus();
    }


    /*  Error
        -----

        Send an error back to the parent
    */

    error(err) {

        this.component.log(`error`, { error: err.stack || err.toString() });

        return this.sendToParent(POST_MESSAGE.ERROR, {
            error: err.stack ? `${err.message}\n${err.stack}` : err.toString()
        });
    }
}
