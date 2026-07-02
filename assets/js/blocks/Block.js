/**
 * Block — Base class for block types.
 *
 * Provides a registry for block type classes and defines the interface
 * that all block type implementations must follow.
 *
 * Usage:
 *   Block.register('my_type', MyBlockClass);
 *   const klass = Block.get('my_type');
 *   const instance = new klass(blockData);
 *   instance.render(container);
 */

const Block = {
    /** @type {Map<string, Function>} */
    _registry: new Map(),

    /**
     * Register a block type class.
     * @param {string} type - Block type identifier (e.g., 'link_list', 'clock')
     * @param {Function} klass - Class constructor
     */
    register(type, klass) {
        if (typeof klass.prototype.render !== 'function') {
            console.warn(`Block.register: ${type} class missing render() method`);
        }
        this._registry.set(type, klass);
    },

    /**
     * Get the class for a block type.
     * @param {string} type
     * @returns {Function|null}
     */
    get(type) {
        return this._registry.get(type) || null;
    },

    /**
     * Get all registered block types with their labels.
     * @returns {Array<{type: string, label: string}>}
     */
    getTypes() {
        const types = [];
        for (const [type, klass] of this._registry) {
            types.push({
                type,
                label: klass.label ? klass.label() : type.replace(/_/g, ' '),
            });
        }
        return types;
    },

    /**
     * Create an instance of a block type.
     * @param {string} type
     * @param {Object} blockData - Block data from the API
     * @returns {Object|null}
     */
    create(type, blockData) {
        const klass = this.get(type);
        if (!klass) {
            console.warn(`Block.create: unknown type "${type}"`);
            return null;
        }
        return new klass(blockData);
    },
};

/**
 * Abstract base class that all block types should extend.
 * Provides common functionality and defines the interface.
 */
class BlockBase {
    /**
     * @param {Object} blockData - Block data from the API
     */
    constructor(blockData) {
        this.blockData = blockData;
        this.blockId = blockData.id;
        this.blockType = blockData.type || 'link_list';
        this.blockTitle = blockData.title || '';
        this.config = this._parseConfig(blockData.config);
        this.items = blockData.items || [];
        this._destroyed = false;
    }

    /**
     * Get the human-readable label for this block type.
     * Override in subclass.
     * @returns {string}
     */
    static label() {
        return 'Block';
    }

    /**
     * Get the default config for a new block of this type.
     * Override in subclass.
     * @returns {Object}
     */
    static defaultConfig() {
        return {};
    }

    /**
     * Get the block type identifier.
     * @returns {string}
     */
    static type() {
        return 'block';
    }

    /**
     * Whether this block type has items (links) that can be added/edited.
     * @returns {boolean}
     */
    hasItems() {
        return false;
    }

    /**
     * Render the block body content into the container.
     * Must be implemented by subclass.
     * @param {HTMLElement} container - The .block-items container
     */
    render(container) {
        throw new Error('BlockBase.render() must be implemented by subclass');
    }

    /**
     * Show the configuration modal for this block.
     * Override in subclass. Default does nothing.
     */
    showConfigModal() {
        // No-op by default — subclasses that need config override this
    }

    /**
     * Clean up resources (intervals, event listeners, etc.).
     * Call when block is removed from DOM.
     */
    destroy() {
        this._destroyed = true;
    }

    /**
     * Parse config JSON from block data.
     * @param {string|Object} config
     * @returns {Object}
     * @private
     */
    _parseConfig(config) {
        if (!config) return {};
        if (typeof config === 'object') return config;
        try {
            return JSON.parse(config);
        } catch {
            return {};
        }
    }
}
