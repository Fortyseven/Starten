/**
 * ClockBlock — Shows live-updating clocks for multiple timezones.
 *
 * Config format:
 * {
 *   "timezones": [
 *     { "zone": "America/New_York", "label": "New York" },
 *     { "zone": "UTC", "label": "UTC" }
 *   ],
 *   "showSeconds": true
 * }
 */

class ClockBlock extends BlockBase {
    static label() {
        return 'Clock';
    }

    static type() {
        return 'clock';
    }

    static defaultConfig() {
        const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return {
            timezones: [
                { zone: localZone, label: 'Local' },
                { zone: 'UTC', label: 'UTC' },
            ],
            showSeconds: true,
        };
    }

    constructor(blockData) {
        super(blockData);
        this._interval = null;
        this._configModalOpen = false;
        // Ensure config has defaults
        if (!this.config.timezones || !Array.isArray(this.config.timezones)) {
            this.config.timezones = ClockBlock.defaultConfig().timezones;
        }
        if (this.config.showSeconds === undefined) {
            this.config.showSeconds = true;
        }
    }

    /**
     * Render clock rows for each timezone.
     * @param {HTMLElement} container - The .block-items container
     */
    render(container) {
        container.classList.add('clock-container');
        container.innerHTML = '';

        const timezones = this.config.timezones || [];
        timezones.forEach((tz) => {
            const row = this._createClockRow(tz);
            container.appendChild(row);
        });

        // Start the tick interval
        this._startTick();
    }

    /**
     * Create a single clock row element.
     * @param {Object} tz - { zone, label }
     * @returns {HTMLElement}
     */
    _createClockRow(tz) {
        const row = document.createElement('div');
        row.className = 'clock-row';
        row.dataset.zone = tz.zone;

        row.innerHTML = `
            <span class="clock-label">${this._escapeHtml(tz.label || tz.zone)}</span>
            <div class="clock-time-wrapper">
                <span class="clock-time"></span>
                <span class="clock-date"></span>
            </div>
        `;

        return row;
    }

    /**
     * Start updating clocks every second.
     * @private
     */
    _startTick() {
        this._stopTick();
        this._tick(); // Immediate first render
        this._interval = setInterval(() => {
            if (!this._destroyed) {
                this._tick();
            }
        }, 1000);
    }

    /**
     * Stop the tick interval.
     * @private
     */
    _stopTick() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
    }

    /**
     * Update all clock displays.
     * @private
     */
    _tick() {
        const container = document.querySelector(`.block[data-id="${this.blockId}"] .clock-container`);
        if (!container) return;

        const timezones = this.config.timezones || [];
        const rows = container.querySelectorAll('.clock-row');
        const showSeconds = this.config.showSeconds !== false;

        const now = new Date();

        rows.forEach((row, i) => {
            const tz = timezones[i];
            if (!tz) return;

            const timeEl = row.querySelector('.clock-time');
            const dateEl = row.querySelector('.clock-date');

            // Format time
            const timeOptions = {
                timeZone: tz.zone,
                hour: 'numeric',
                minute: '2-digit',
                second: showSeconds ? '2-digit' : undefined,
                hour12: true,
            };

            // Format date
            const dateOptions = {
                timeZone: tz.zone,
                weekday: 'short',
                month: 'short',
                day: 'numeric',
            };

            try {
                const timeFormatter = new Intl.DateTimeFormat('en-US', timeOptions);
                const dateFormatter = new Intl.DateTimeFormat('en-US', dateOptions);

                timeEl.textContent = timeFormatter.format(now);
                dateEl.textContent = dateFormatter.format(now);
            } catch (e) {
                timeEl.textContent = 'Invalid timezone';
                dateEl.textContent = tz.zone;
            }
        });
    }

    /**
     * Show the clock configuration modal.
     */
    showConfigModal() {
        if (this._configModalOpen) return;
        this._configModalOpen = true;

        // Create modal elements
        const overlay = document.createElement('div');
        overlay.className = 'type-picker-overlay';
        overlay.id = 'clock-config-overlay';

        const modal = document.createElement('div');
        modal.className = 'clock-config-modal';
        modal.id = 'clock-config-modal';

        modal.innerHTML = `
            <div class="clock-config-header">
                <h2>Clock Settings</h2>
                <button class="clock-config-close" aria-label="Close">&times;</button>
            </div>
            <div class="clock-config-body">
                <div class="clock-config-toggle">
                    <input type="checkbox" id="clock-show-seconds" ${this.config.showSeconds !== false ? 'checked' : ''}>
                    <label for="clock-show-seconds">Show seconds</label>
                </div>
                <div>
                    <div style="font-size: 13px; font-weight: 500; color: var(--text-secondary); margin-bottom: 8px;">Timezones</div>
                    <div class="clock-timezone-list"></div>
                </div>
                <div class="clock-add-timezone">
                    <select class="clock-zone-select"></select>
                    <input type="text" class="clock-label-input" placeholder="Label (optional)">
                    <button class="clock-add-btn" title="Add timezone">+</button>
                </div>
            </div>
            <div class="clock-config-footer">
                <button class="clock-config-btn clock-config-btn-secondary" id="clock-config-cancel">Cancel</button>
                <button class="clock-config-btn clock-config-btn-primary" id="clock-config-save">Save</button>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        // Populate timezone list
        const timezoneList = modal.querySelector('.clock-timezone-list');
        this._renderTimezoneList(timezoneList);

        // Populate timezone dropdown
        const zoneSelect = modal.querySelector('.clock-zone-select');
        this._populateZoneSelect(zoneSelect);

        // Animate in
        requestAnimationFrame(() => {
            overlay.classList.add('open');
            modal.classList.add('open');
        });

        // Collect pending additions
        const pendingTimezones = [...this.config.timezones];

        // Re-render the entire timezone list from pendingTimezones
        const reRenderList = () => {
            timezoneList.innerHTML = '';
            pendingTimezones.forEach(tz => {
                this._addTimezoneItem(timezoneList, tz);
            });
        };

        // Event: Remove timezone
        timezoneList.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.clock-timezone-remove');
            if (removeBtn) {
                const item = removeBtn.closest('.clock-timezone-item');
                const zone = item.dataset.zone;
                const idx = pendingTimezones.findIndex(tz => tz.zone === zone);
                if (idx !== -1) {
                    pendingTimezones.splice(idx, 1);
                    item.remove();
                }
            }
        });

        // Event: Drag-and-drop reordering
        this._initTimezoneDragDrop(timezoneList, { timezones: pendingTimezones, render: reRenderList });

        // Commit any pending timezone from the add form into pendingTimezones
        const commitPendingTimezone = () => {
            const zone = zoneSelect.value;
            if (!zone) return;
            const labelInput = modal.querySelector('.clock-label-input');
            const label = labelInput.value.trim() || zoneSelect.options[zoneSelect.selectedIndex].text;

            if (!pendingTimezones.find(tz => tz.zone === zone)) {
                pendingTimezones.push({ zone, label });
                this._addTimezoneItem(timezoneList, { zone, label });
            }
            labelInput.value = '';
        };

        // Event: Add timezone
        const addBtn = modal.querySelector('.clock-add-btn');
        addBtn.addEventListener('click', commitPendingTimezone);

        // Event: Seconds toggle
        const secondsCheckbox = modal.querySelector('#clock-show-seconds');

        // Event: Cancel / Close
        let closed = false;
        const close = () => {
            if (closed) return;
            closed = true;
            this._configModalOpen = false;

            // Remove keydown listener
            if (this._clockConfigKeydown) {
                document.removeEventListener('keydown', this._clockConfigKeydown);
                this._clockConfigKeydown = null;
            }

            overlay.classList.remove('open');
            modal.classList.remove('open');
            setTimeout(() => {
                overlay.remove();
                modal.remove();
            }, 250);
        };

        // Event: Save
        const save = async () => {
            // Commit any pending timezone entry before saving
            commitPendingTimezone();

            const newConfig = {
                ...this.config,
                timezones: pendingTimezones,
                showSeconds: secondsCheckbox.checked,
            };

            await api('blocks:update', {
                id: this.blockId,
                config: newConfig,
            });

            // Close modal immediately
            if (!closed) {
                closed = true;
                this._configModalOpen = false;
                if (this._clockConfigKeydown) {
                    document.removeEventListener('keydown', this._clockConfigKeydown);
                    this._clockConfigKeydown = null;
                }
            }
            overlay.classList.remove('open');
            modal.classList.remove('open');
            setTimeout(() => { overlay.remove(); modal.remove(); }, 300);

            // Reload blocks
            await Blocks.load();
        };

        modal.querySelector('#clock-config-save').addEventListener('click', save);

        modal.querySelector('.clock-config-close').addEventListener('click', close);
        modal.querySelector('#clock-config-cancel').addEventListener('click', close);
        overlay.addEventListener('click', close);

        // Keyboard
        const onKeydown = (e) => {
            if (e.key === 'Escape') close();
            if (e.key === 'Enter' && e.target.classList.contains('clock-label-input')) {
                e.preventDefault();
                addBtn.click();
            }
        };
        document.addEventListener('keydown', onKeydown);
        this._clockConfigKeydown = onKeydown;
    }

    /**
     * Render timezone items in the config modal list.
     * @param {HTMLElement} list
     * @private
     */
    _renderTimezoneList(list) {
        list.innerHTML = '';
        (this.config.timezones || []).forEach(tz => {
            this._addTimezoneItem(list, tz);
        });
    }

    /**
     * Add a single timezone item to the list.
     * @param {HTMLElement} list
     * @param {Object} tz
     * @private
     */
    _addTimezoneItem(list, tz) {
        const item = document.createElement('div');
        item.className = 'clock-timezone-item';
        item.dataset.zone = tz.zone;
        item.draggable = true;
        item.innerHTML = `
            <span class="clock-timezone-grip" title="Drag to reorder" aria-label="Drag to reorder">⠿</span>
            <span class="clock-timezone-label">${this._escapeHtml(tz.label || tz.zone)}</span>
            <span class="clock-timezone-zone">${this._escapeHtml(tz.zone)}</span>
            <button class="clock-timezone-remove" title="Remove" aria-label="Remove">×</button>
        `;
        list.appendChild(item);
    }

    /**
     * Attach drag-and-drop reordering to the timezone list.
     * @param {HTMLElement} list - The .clock-timezone-list container
     * @param {Object} pending - { timezones: [...], add: fn, remove: fn }
     * @private
     */
    _initTimezoneDragDrop(list, pending) {
        let draggedZone = null;
        let dragOverZone = null;

        const onDragStart = (e) => {
            const item = e.target.closest('.clock-timezone-item');
            if (!item) return;
            draggedZone = item.dataset.zone;
            item.classList.add('clock-timezone-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedZone);
        };

        const onDragEnd = (e) => {
            const item = e.target.closest('.clock-timezone-item');
            if (item) item.classList.remove('clock-timezone-dragging');
            list.querySelectorAll('.clock-timezone-item.clock-timezone-drag-over').forEach(el => {
                el.classList.remove('clock-timezone-drag-over');
            });
            draggedZone = null;
            dragOverZone = null;
        };

        const onDragOver = (e) => {
            e.preventDefault();
            if (!draggedZone) return;

            const item = e.target.closest('.clock-timezone-item');
            if (!item || item.dataset.zone === draggedZone) return;

            // Remove drag-over from all items
            list.querySelectorAll('.clock-timezone-item.clock-timezone-drag-over').forEach(el => {
                el.classList.remove('clock-timezone-drag-over');
            });

            dragOverZone = item.dataset.zone;
            item.classList.add('clock-timezone-drag-over');
        };

        const onDragLeave = (e) => {
            const item = e.target.closest('.clock-timezone-item');
            if (item) item.classList.remove('clock-timezone-drag-over');
        };

        const onDrop = (e) => {
            e.preventDefault();
            const targetItem = e.target.closest('.clock-timezone-item');
            if (!targetItem || !draggedZone) return;

            const targetZone = targetItem.dataset.zone;
            if (targetZone === draggedZone) return;

            // Reorder the pending array: move draggedZone to targetZone's position
            const fromIdx = pending.timezones.findIndex(tz => tz.zone === draggedZone);
            const toIdx = pending.timezones.findIndex(tz => tz.zone === targetZone);
            if (fromIdx === -1 || toIdx === -1) return;

            const [moved] = pending.timezones.splice(fromIdx, 1);
            pending.timezones.splice(toIdx, 0, moved);

            // Re-render the list to reflect new order
            pending.render();
        };

        list.addEventListener('dragstart', onDragStart);
        list.addEventListener('dragend', onDragEnd);
        list.addEventListener('dragover', onDragOver);
        list.addEventListener('dragleave', onDragLeave);
        list.addEventListener('drop', onDrop);
    }

    /**
     * Populate the timezone select dropdown with IANA timezones.
     * @param {HTMLSelectElement} select
     * @private
     */
    _populateZoneSelect(select) {
        // Use Intl to get available timezones
        let zones = [];
        try {
            zones = Intl.supportedValuesOf('timeZone');
        } catch {
            // Fallback for older browsers
            zones = this._fallbackTimezones();
        }

        zones.sort().forEach(zone => {
            const option = document.createElement('option');
            option.value = zone;
            // Clean up the timezone name for display
            option.textContent = zone.replace(/_/g, ' ').replace(/Time Zone/i, 'TZ');
            select.appendChild(option);
        });
    }

    /**
     * Fallback timezone list for browsers without Intl.supportedValuesOf.
     * @returns {string[]}
     * @private
     */
    _fallbackTimezones() {
        return [
            'UTC',
            'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
            'America/Anchorage', 'Pacific/Honolulu',
            'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
            'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
            'Australia/Sydney', 'Pacific/Auckland',
        ];
    }

    /**
     * Escape HTML to prevent XSS.
     * @param {string} str
     * @returns {string}
     * @private
     */
    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Clean up resources.
     */
    destroy() {
        this._stopTick();
        if (this._clockConfigKeydown) {
            document.removeEventListener('keydown', this._clockConfigKeydown);
            this._clockConfigKeydown = null;
        }
        this._configModalOpen = false;
        super.destroy();
    }
}

// Register this block type
Block.register(ClockBlock.type(), ClockBlock);
