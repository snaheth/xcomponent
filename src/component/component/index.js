
import $logger from 'beaver-logger/client';

import { ChildComponent } from '../child';
import { ParentComponent } from '../parent';
import { internalProps } from './props';
import { isXComponentWindow } from '../window';
import { CONTEXT_TYPES_LIST } from '../../constants';
import { validate } from './validate';

import parentTemplate from './templates/parent.htm';
import componentTemplate from './templates/component.htm';

import * as drivers from '../../drivers';

export let components = {};


/*  Component
    ---------

    This is the spec for the component. The idea is, when I call xcomponent.create(), it will create a new instance
    of Component with the blueprint needed to set up ParentComponents and ChildComponents.

    This is the one portion of code which is required by -- and shared to -- both the parent and child windows, and
    contains all of the configuration needed for them to set themselves up.
*/

export class Component {

    constructor(options = {}) {

        this.validate(options);

        if (options.dimensions) {
            if (typeof options.dimensions.width !== 'number') {
                throw new Error(`[${options.tag}] Expected options.dimensions.width to be a number`);
            }

            if (typeof options.dimensions.height !== 'number') {
                throw new Error(`[${options.tag}] Expected options.dimensions.height to be a number`);
            }
        }
        // The tag name of the component. Used by some drivers (e.g. angular) to turn the component into an html element,
        // e.g. <my-component>

        this.tag = options.tag;

        // Name of the component, used for logging. Auto-generated from the tag name by default.

        this.name = options.name || options.tag.replace(/-/g, '_');

        // A json based spec describing what kind of props the component accepts. This is used to validate any props before
        // they are passed down to the child.

        this.props = {
            ...options.props,
            ...internalProps
        };

        // The dimensions of the component, e.g. { width: 500, height: 200 }

        this.dimensions = options.dimensions || {};

        // The default environment we should render to if none is specified in the parent

        this.defaultEnv = options.defaultEnv;

        // A mapping of env->url, used to determine which url to load for which env

        this.envUrls = options.envUrls || {};

        // A url to use by default to render the component, if not using envs

        this.url = options.url     || options.envUrls[options.defaultEnv];

        // The allowed contexts. For example { iframe: true, lightbox: false, popup: false }. Defaults to true for all.

        this.contexts = options.contexts || {};
        for (let context of CONTEXT_TYPES_LIST) {
            this.contexts[context] = (this.contexts[context] === undefined) ? true : Boolean(this.contexts[context]);
        }

        this.closeDelay = options.closeDelay;

        // The default context to render to

        this.defaultContext = options.defaultContext;

        // Should this be a singleton component? Do I want to allow it to be rendered more than once on the same page?

        this.singleton = options.singleton;

        // Auto Resize option

        this.autoResize = options.autoResize || false;

        this.autocloseParentTemplate = options.autocloseParentTemplate === undefined ? true : options.autocloseParentTemplate;

        // Templates and styles for the parent page and the initial rendering of the component

        this.parentTemplate    = options.parentTemplate    || parentTemplate;
        this.componentTemplate = options.componentTemplate || componentTemplate;

        // A mapping of tag->component so we can reference components by string tag name

        components[this.tag] = this;

        // Register all of the drivers for instantiating components. The model used is -- there's a standard javascript
        // way of rendering a component, then each other technology (e.g. react) needs to hook into that interface.
        // This makes us a little more pluggable and loosely coupled.

        for (let driverName of Object.keys(drivers)) {
            let driver = drivers[driverName];
            if (driver.isActive()) {
                driver.register(this);
            }
        }
    }


    isXComponent() {
        return isXComponentWindow();
    }


    /*  Parent
        ------

        Get an instance of the parent for this component (lives on the parent page which contains the component)
    */

    parent(options) {
        return new ParentComponent(this, options);
    }


    /*  Child
        -----

        Get an instance of the child for this component (lives on the child component page which lives in the parent)
    */

    child(options) {
        return new ChildComponent(this, options);
    }


    /*  Attach
        ------

        Shortcut to instantiate a child in a child component window
    */

    attach(options) {
        let component = this.child(options);
        component.init();
        return component;
    }


    /*  Init
        ----

        Shortcut to instantiate a component on a parent page, with props
    */

    init(props) {
        return new ParentComponent(this, { props });
    }


    /*  Render
        ------

        Shortcut to render a parent component
    */

    render(props, element) {
        return this.init(props).render(element);
    }


    /*  Get By Tag
        ----------

        Get a component instance by tag name
    */

    getByTag(tag) {
        return components[tag];
    }


    /*  Validate
        --------

        Validate any options passed into Component
    */

    validate(options) {
        return validate(options);
    }


    /*  Log
        ---

        Log an event using the component name
    */

    log(event, payload = {}) {
        payload.host = window.location.host;
        payload.path = window.location.pathname;
        $logger.info(`xc_${this.name}_${event}`, payload);
    }


    /*  Log Warning
        -----------

        Log a warning
    */

    logWarning(event, payload) {
        $logger.warn(`xc_${this.name}_${event}`, payload);
    }


    /*  Log Error
        ---------

        Log an error
    */

    logError(event, payload) {
        $logger.error(`xc_${this.name}_${event}`, payload);
    }
}