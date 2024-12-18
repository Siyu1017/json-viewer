'use strict';

(() => {
    function isJSON(item) {
        let value = typeof item !== "string" ? JSON.stringify(item) : item;
        try {
            value = JSON.parse(value);
        } catch (e) {
            return false;
        }

        return typeof value === "object" && value !== null;
    }

    function isObject(obj) {
        var type = typeof obj;
        return type === 'function' || type === 'object' && !!obj;
    };

    function expandable(obj) {
        if (Array.isArray(obj)) {
            if (obj.length > 0) {
                return true;
            }
            return false;
        } else if (isObject(obj)) {
            if (Object.values(obj).length > 0) {
                return true;
            }
            return false;
        } else {
            return false;
        }
    }

    function setAttribute(element, value) {
        if (expandable(value)) {
            element.setAttribute('data-expandable', true);
        } else {
            element.setAttribute('data-expandable', false);
        }
    }

    function parseJSON(json, self = false) {
        try {
            if (self == false) {
                json = JSON.parse(json);
            }
            var result = json;
            if (Array.isArray(json)) {
                result = [];
                json.forEach(obj => {
                    result.push(parseJSON(obj, true))
                })
                return result;
            } else if (isObject(json)) {
                result = {};
                Object.keys(json).forEach(key => {
                    result[key] = parseJSON(json[key], true);
                })
                return result;
            } else {
                return result;
            }
        } catch (e) { }
    }

    function isLargeArray(array) {
        if (array.length > 100) {
            return true;
        }
        return false;
    }

    function getClassName(value) {
        var type = typeof value;
        switch (type) {
            case 'string':
                return 'json-viewer-value-string';
            case 'number':
                return 'json-viewer-value-number';
            case 'boolean':
                return 'json-viewer-value-symbol';
            case 'object':
                if (value === null) {
                    return 'json-viewer-value-empty';
                } else if (Array.isArray(value)) {
                    return 'json-viewer-value-generic';
                } else {
                    return 'json-viewer-value-generic';
                }
            case 'undefined':
                return 'json-viewer-value-empty';
            default:
                return 'json-viewer-value-generic';
        }
    }

    function getStackTrace() {
        var stack;

        try {
            throw new Error('');
        } catch (error) {
            stack = error.stack || '';
        }

        stack = stack.split('\n').map(function (line) { return line.trim(); });
        return stack.splice(stack[0] == 'Error' ? 2 : 1);
    }

    function getType(value) {
        var type = typeof value;
        switch (type) {
            case 'string':
                return 'string';
            case 'number':
                return 'number';
            case 'boolean':
                return 'boolean';
            case 'object':
                if (value === null) {
                    return 'null';
                } else if (Array.isArray(value)) {
                    return 'array';
                } else if (isObject(value)) {
                    return 'object';
                } else {
                    return 'object?';
                }
            case 'undefined':
                return 'undefined';
            default:
                return 'unknown';
        }
    }

    function getBracket(value, type) {
        if (type == 'array') {
            return `[${value}]`;
        } else if (type == 'object') {
            return `{${value}}`;
        } else {
            return value;
        }
    }

    var listeners = {};

    class Viewer {
        constructor(json) {
            this.container = document.createElement('div');
            this.path = document.createElement('div');
            this.overview = document.createElement('div');
            this.overviewExpand = document.createElement('div');
            this.overviewContent = document.createElement('div');
            this.content = document.createElement('div');

            this.container.className = 'json-viewer-container';
            this.path.className = 'json-viewer-path';
            this.overview.className = 'json-viewer-overview';
            this.overviewExpand.className = 'json-viewer-expand';
            this.overviewContent.className = 'json-viewer-overview-content';
            this.content.className = 'json-viewer-content';

            this.container.appendChild(this.path);
            this.container.appendChild(this.overview);
            this.container.appendChild(this.content);
            this.overview.appendChild(this.overviewExpand);
            this.overview.appendChild(this.overviewContent);

            if (typeof json != 'string') {
                try {
                    json = JSON.stringify(json);
                } catch (e) { }
            }

            if (isJSON(json) == false || !json || json == null) {
                try {
                    this.container.innerHTML = json.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
                } catch (e) {
                    this.container.innerHTML = json;
                }
                return this;
            }

            this.json = typeof json != 'string' ? parseJSON(JSON.stringify(json)) : parseJSON(json);

            setAttribute(this.overview, this.json);

            var expanded = false;
            var appended = false;
            /*
            Object.keys(parsed).forEach(key1 => {
                if (isObject(parsed[key1])) {
                    parsed[key1].forEach(key2 => {
                        if (isObject(parsed[key1][key2])) {
                            parsed[key1][key2].forEach(key3 => {
                                overviewText += parsed[key1][key2][key3];
                            })
                        }
                    })
                }
            })
                */

            this.overviewContent.innerHTML = expandable(this.json) == true ? this._getOverview(this.json).replaceAll("<", "&lt;").replaceAll(">", "&gt;") : this._formatValue(this.json).replaceAll("<", "&lt;").replaceAll(">", "&gt;");

            this.overview.addEventListener('click', () => {
                expanded = !expanded;
                this.overview.setAttribute('data-expand', expanded);
                if (appended == false) {
                    this._getLevel(this.json, this.content);
                    appended = true;
                }
            })
            this.overview.addEventListener('pointerenter', () => {
                this._triggerEvent('pointerChange', {
                    type: getType(this.json),
                    levels: [{
                        type: getType(this.json),
                        key: '…',
                        item: this.overview
                    }],
                    value: this.json
                })
            })
            return this;
        }
        on(event, listener) {
            if (!listeners[event]) {
                listeners[event] = [];
            }
            listeners[event].push(listener);
        }
        _triggerEvent(event, details) {
            if (listeners[event]) {
                listeners[event].forEach(listener => {
                    listener(details);
                })
            }
        }
        _getLevel(level, parent, parentData = {
            levels: [],
            type: level.type
        }) {
            const parentLevels = [...parentData.levels];

            if (getType(level) == 'array') {
                if (isLargeArray(level)) {
                    var groups = level.length % 100 == 0 ? Math.floor(level.length / 100) : Math.floor(level.length / 100) + 1
                    for (let i = 0; i < groups; i++) {
                        (() => {
                            var item = document.createElement('div');
                            var line = document.createElement('div');
                            var next = document.createElement('div');
                            var expanded = false;
                            var append = false;
                            var value = level.slice(i * 100, (i + 1) * 100);
                            var type = getClassName(value);
                            item.className = 'json-viewer-item';
                            line.className = 'json-viewer-line';
                            next.className = 'json-viewer-next';
                            line.innerHTML = `<div class="json-viewer-expand"></div><div class="json-viewer-key" data-type="large-array"></div><div class="json-viewer-value ${type}">[${i * 100} … ${99 > value.length ? i * 100 + value.length - 1 : i * 100 + 99}]</div>`;

                            var temp = {};
                            Object.keys(value).forEach(key => {
                                temp[i * 100 + +key] = value[key];
                            })
                            value = temp;

                            line.setAttribute('data-expandable', expandable(value));
                            line.setAttribute('data-expand', expanded);
                            line.addEventListener('click', () => {
                                if (expandable(value) == true) {
                                    expanded = !expanded;
                                    line.setAttribute('data-expand', expanded);
                                    if (append == false) {
                                        this._getLevel(value, next, {
                                            type: 'array',
                                            levels: parentLevels,
                                            item: line
                                        });
                                        append = true;
                                    }
                                }
                            })
                            line.addEventListener('pointerenter', () => {
                                this._triggerEvent('pointerChange', {
                                    type: 'array',
                                    levels: parentLevels,
                                    value: value,
                                    item: line
                                })
                            })
                            item.appendChild(line);
                            item.appendChild(next);
                            parent.appendChild(item);
                        })();
                    }
                    return;
                }
            }
            var temp = level;
            level = Object.keys(temp).sort().reduce(
                (obj, key) => {
                    obj[key] = temp[key];
                    return obj;
                },
                {}
            );
            Object.keys(level).forEach(key => {
                var item = document.createElement('div');
                var line = document.createElement('div');
                var next = document.createElement('div');
                var expanded = false;
                var append = false;
                var type = getClassName(level[key]);
                item.className = 'json-viewer-item';
                line.className = 'json-viewer-line';
                next.className = 'json-viewer-next';
                line.innerHTML = `<div class="json-viewer-expand"></div><div class="json-viewer-key">${key}</div><div class="json-viewer-value ${type}">${getType(this._formatValue(level[key])) == 'string' ? this._formatValue(level[key]).replaceAll("<", "&lt;").replaceAll(">", "&gt;") : this._formatValue(level[key])}</div>`;

                line.setAttribute('data-expandable', expandable(level[key]));
                line.setAttribute('data-expand', expanded);
                line.addEventListener('click', () => {
                    if (expandable(level[key]) == true) {
                        expanded = !expanded;
                        line.setAttribute('data-expand', expanded);
                        if (append == false) {
                            this._getLevel(level[key], next, {
                                type: getType(level),
                                levels: parentLevels.concat([{
                                    type: getType(level[key]),
                                    key: key,
                                    item: line
                                }])
                            });
                            append = true;
                        }
                    }
                })
                line.addEventListener('pointerenter', () => {
                    this._triggerEvent('pointerChange', {
                        type: getType(level[key]),
                        levels: parentLevels.concat([{
                            type: getType(level[key]),
                            key: key,
                            item: line
                        }]),
                        value: level[key]
                    })
                })
                item.appendChild(line);
                item.appendChild(next);
                parent.appendChild(item);
            })
        }
        _getOverview(level, current = 0, type) {
            if (current > 3) {
                return '…';
            }
            if (!type) {
                type = getType(level);
            }
            var overview = '';
            var allow = true;
            Object.keys(level).forEach((key, i) => {
                if (allow == false) {
                    return;
                }
                var itemType = getType(level[key]);
                if (itemType == 'array') {
                    var next = getBracket(this._getOverview(level[key], current + 1, itemType));
                    if (type == 'array') {
                        overview += next;
                    } else {
                        overview += `${key}: ${next}`;
                    }
                } else if (itemType == 'object') {
                    var next = getBracket(this._getOverview(level[key], current + 1, itemType));
                    if (type == 'array') {
                        overview += next;
                    } else {
                        overview += `${key}: ${next}`;
                    }
                } else {
                    if (type == 'array') {
                        overview += `${this._formatValue(level[key])}`;
                    } else {
                        overview += `${key}: ${this._formatValue(level[key])}`;
                    }
                }
                if (Object.keys(level)[i + 1]) {
                    if (overview.length > 50) {
                        overview += ',';
                        allow = false;
                    } else {
                        overview += ', ';
                    }
                }
                if (overview.length > 50) {
                    allow = false;
                }
            })
            if (allow == false) {
                overview += '…';
            }
            return getBracket(overview, getType(level));
        }
        _formatValue(value) {
            if (expandable(value)) {
                return this._getOverview(value);
            }
            if (getType(value) === 'string') {
                return `\"${value}\"`;
            } else if (getType(value) === 'array') {
                return '[]';
            } else if (getType(value) === 'object') {
                return '{}';
            } else {
                return value;
            }
        }
    }

    window.Viewer = Viewer;
})();
