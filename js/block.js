// Copyright (c) 2014-18 Walter Bender
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the The GNU Affero General Public
// License as published by the Free Software Foundation; either
// version 3 of the License, or (at your option) any later version.
//
// You should have received a copy of the GNU Affero General Public
// License along with this library; if not, write to the Free Software
// Foundation, 51 Franklin Street, Suite 500 Boston, MA 02110-1335 USA
//

// Length of a long touch
const TEXTWIDTH = 240; // 90
const STRINGLEN = 9;
const LONGPRESSTIME = 1500;
const COLLAPSABLES = ['drum', 'start', 'action', 'matrix', 'pitchdrummatrix', 'rhythmruler', 'timbre', 'status', 'pitchstaircase', 'tempo', 'pitchslider', 'modewidget'];
const NOHIT = ['hidden', 'hiddennoflow'];
const SPECIALINPUTS = ['text', 'number', 'solfege', 'eastindiansolfege', 'notename', 'voicename', 'modename', 'drumname', 'filtertype', 'oscillatortype', 'boolean', 'intervalname', 'invertmode', 'accidentalname', 'temperamentname'];
const WIDENAMES = ['intervalname', 'accidentalname', 'drumname', 'voicename', 'modename', 'temperamentname'];
const EXTRAWIDENAMES = ['modename'];
const PIEMENUS = ['solfege', 'eastindiansolfege', 'notename', 'voicename', 'drumname', 'accidentalname', 'invertmode', 'boolean', 'filtertype', 'oscillatortype', 'intervalname', 'modename', 'temperamentname'];

// Define block instance objects and any methods that are intra-block.
function Block(protoblock, blocks, overrideName) {
    if (protoblock === null) {
        console.log('null protoblock sent to Block');
        return;
    }

    this.protoblock = protoblock;
    this.name = protoblock.name;
    this.overrideName = overrideName;
    this.blocks = blocks;
    this.collapsed = false;  // Is this block in a collapsed stack?
    this.trash = false;  // Is this block in the trash?
    this.loadComplete = false;  // Has the block finished loading?
    this.label = null;  // Editable textview in DOM.
    this.labelattr = null;  // Editable textview in DOM.
    this.text = null;  // A dynamically generated text label on block itself.
    this.value = null;  // Value for number, text, and media blocks.
    this.privateData = null;  // A block may have some private data,
                              // e.g., nameboxes use this field to store
                              // the box name associated with the block.
    this.image = protoblock.image;  // The file path of the image.
    this.imageBitmap = null;

    // All blocks have at a container and least one bitmap.
    this.container = null;
    this.bounds = null;
    this.width = 0;
    this.height = 0;
    this.hitHeight = 0;
    this.bitmap = null;
    this.highlightBitmap = null;

    // The svg from which the bitmaps are generated
    this.artwork = null;
    this.collapseArtwork = null;

    // Start and Action blocks has a collapse button (in a separate
    // container).
    this.collapseContainer = null;
    this.collapseBitmap = null;
    this.expandBitmap = null;
    this.collapseBlockBitmap = null;
    this.highlightCollapseBlockBitmap = null;
    this.collapseText = null;

    this.size = 1;  // Proto size is copied here.
    this.docks = [];  // Proto dock is copied here.
    this.connections = [];

    // Keep track of clamp count for blocks with clamps.
    this.clampCount = [1, 1];
    this.argClampSlots = [1];

    // Some blocks have some post process after they are first loaded.
    this.postProcess = null;
    this.postProcessArg = this;

    // Lock on label change
    this._label_lock = false;

    // Internal function for creating cache.
    // Includes workaround for a race condition.
    this._createCache = function (callback, args) {
        var that = this;
        this.bounds = this.container.getBounds();

        if (this.bounds == null) {
            setTimeout(function () {
                that._createCache(callback, args);
            }, 100);
        } else {
            this.container.cache(this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height);
            callback(this, args);
        }
    };

    // Internal function for creating cache.
    // Includes workaround for a race condition.
    // Does this race condition still occur?
    this.updateCache = function () {
        var that = this;

        if (this.bounds == null) {
            setTimeout(function () {
                console.log('CACHE NOT READY');
                that.updateCache();
            }, 200);
        } else {
            this.container.updateCache();
            this.blocks.refreshCanvas();
        }
    };

    this.offScreen = function (boundary) {
        return !this.trash && boundary.offScreen(this.container.x, this.container.y);
    };

    this.copySize = function () {
        this.size = this.protoblock.size;
    };

    this.getInfo = function () {
        return this.name + ' block';
    };

    this.highlight = function () {
        if (this.collapsed && COLLAPSABLES.indexOf(this.name) !== -1) {
            // We may have a race condition.
            if (this.highlightCollapseBlockBitmap) {
                this.highlightCollapseBlockBitmap.visible = true;
                this.collapseBlockBitmap.visible = false;
                this.collapseText.visible = true;
                this.bitmap.visible = false;
                this.highlightBitmap.visible = false;
            }
        } else {
            this.bitmap.visible = false;
            this.highlightBitmap.visible = true;
            if (COLLAPSABLES.indexOf(this.name) !== -1) {
                // There could be a race condition when making a
                // new action block.
                if (this.highlightCollapseBlockBitmap) {
                    if (this.collapseText !== null) {
                        this.collapseText.visible = false;
                    }
                    if (this.collapseBlockBitmap.visible !== null) {
                        this.collapseBlockBitmap.visible = false;
                    }
                    if (this.highlightCollapseBlockBitmap.visible !== null) {
                        this.highlightCollapseBlockBitmap.visible = false;
                    }
                }
            }
        }

        this.updateCache();
    };

    this.unhighlight = function () {
        if (this.collapsed && COLLAPSABLES.indexOf(this.name) !== -1) {
            if (this.highlightCollapseBlockBitmap) {
                this.highlightCollapseBlockBitmap.visible = false;
                this.collapseBlockBitmap.visible = true;
                this.collapseText.visible = true;
                this.bitmap.visible = false;
                this.highlightBitmap.visible = false;
            }
        } else {
            this.bitmap.visible = true;
            this.highlightBitmap.visible = false;
            if (COLLAPSABLES.indexOf(this.name) !== -1) {
                if (this.highlightCollapseBlockBitmap) {
                    this.highlightCollapseBlockBitmap.visible = false;
                    this.collapseBlockBitmap.visible = false;
                    this.collapseText.visible = false;
                }
            }
        }

        this.updateCache();
    };

    this.updateArgSlots = function (slotList) {
        // Resize and update number of slots in argClamp
        this.argClampSlots = slotList;
        this._newArtwork();
        this.regenerateArtwork(false);
    };

    this.updateSlots = function (clamp, plusMinus) {
        // Resize an expandable block.
        this.clampCount[clamp] += plusMinus;
        this._newArtwork(plusMinus);
        this.regenerateArtwork(false);
    };

    this.resize = function (scale) {
        // If the block scale changes, we need to regenerate the
        // artwork and recalculate the hitarea.
        var that = this;

        this.postProcess = function (that) {
            if (that.imageBitmap !== null) {
                that._positionMedia(that.imageBitmap, that.imageBitmap.image.width, that.imageBitmap.image.height, scale);
                z = that.container.children.length - 1;
                that.container.setChildIndex(that.imageBitmap, z);
            }

            if (that.name === 'start' || that.name === 'drum') {
                // Rescale the decoration on the start blocks.
                for (var turtle = 0; turtle < that.blocks.turtles.turtleList.length; turtle++) {
                    if (that.blocks.turtles.turtleList[turtle].startBlock === that) {
                        that.blocks.turtles.turtleList[turtle].resizeDecoration(scale, that.bitmap.image.width);
                        that._ensureDecorationOnTop();
                        break;
                    }
                }
            }

            that.updateCache();
            that._calculateBlockHitArea();

            // If it is in the trash, make sure it remains hidden.
            if (that.trash) {
                that.hide();
            }
        };

        this.postProcessArg = this;

        this.protoblock.scale = scale;
        this._newArtwork(0);
        this.regenerateArtwork(true, []);

        if (this.text !== null) {
            this._positionText(scale);
        }

        if (this.collapseContainer !== null) {
            this.collapseContainer.uncache();
            var _postProcess = function (that) {
                that.collapseBitmap.scaleX = that.collapseBitmap.scaleY = that.collapseBitmap.scale = scale / 2;
                that.expandBitmap.scaleX = that.expandBitmap.scaleY = that.expandBitmap.scale = scale / 2;

                that._positionCollapseContainer(that.protoblock.scale);

                // bounds is not calculating correctly -- see #1142 --
                // so sizing cache by hand.
                that.collapseContainer.cache(0, 0, 55 * scale / 2, 55 * scale / 2);
                that._positionCollapseContainer(that.protoblock.scale);
                that._calculateCollapseHitArea();
            };

            this._generateCollapseArtwork(_postProcess);
            var fontSize = 10 * scale;
            this.collapseText.font = fontSize + 'px Sans';
            this._positionCollapseLabel(scale);
        }
    };

    this._newArtwork = function (plusMinus) {
        if (COLLAPSABLES.indexOf(this.name) > -1) {
            var proto = new ProtoBlock('collapse');
            proto.scale = this.protoblock.scale;
            proto.extraWidth = 40;
            proto.basicBlockCollapsed();
            var obj = proto.generator();
            this.collapseArtwork = obj[0];
            var obj = this.protoblock.generator(this.clampCount[0]);
        } else if (this.name === 'ifthenelse') {
            var obj = this.protoblock.generator(this.clampCount[0], this.clampCount[1]);
        } else if (this.protoblock.style === 'clamp') {
            var obj = this.protoblock.generator(this.clampCount[0]);
        } else if (this.protoblock.style === 'argflowclamp') {
            var obj = this.protoblock.generator(this.clampCount[0]);
        } else {
            switch (this.name) {
            case 'equal':
            case 'greater':
            case 'less':
                var obj = this.protoblock.generator(this.clampCount[0]);
                break;
            case 'makeblock':
            case 'calcArg':
            case 'doArg':
            case 'namedcalcArg':
            case 'nameddoArg':
                var obj = this.protoblock.generator(this.argClampSlots);
                this.size = 2;
                for (var i = 0; i < this.argClampSlots.length; i++) {
                    this.size += this.argClampSlots[i];
                }
                this.docks = [];
                this.docks.push([obj[1][0][0], obj[1][0][1], this.protoblock.dockTypes[0]]);
                break;
            default:
                if (this.isArgBlock()) {
                    var obj = this.protoblock.generator(this.clampCount[0]);
                } else if (this.isTwoArgBlock()) {
                    var obj = this.protoblock.generator(this.clampCount[0]);
                } else {
                    var obj = this.protoblock.generator();
                }
                this.size += plusMinus;
                break;
            }
        }

        switch (this.name) {
        case 'nameddoArg':
            for (var i = 1; i < obj[1].length - 1; i++) {
                this.docks.push([obj[1][i][0], obj[1][i][1], 'anyin']);
            }

            this.docks.push([obj[1][2][0], obj[1][2][1], 'in']);
            break;
        case 'namedcalcArg':
            for (var i = 1; i < obj[1].length; i++) {
                this.docks.push([obj[1][i][0], obj[1][i][1], 'anyin']);
            }
            break;
        case 'doArg':
            this.docks.push([obj[1][1][0], obj[1][1][1], this.protoblock.dockTypes[1]]);
            for (var i = 2; i < obj[1].length - 1; i++) {
                this.docks.push([obj[1][i][0], obj[1][i][1], 'anyin']);
            }

            this.docks.push([obj[1][3][0], obj[1][3][1], 'in']);
            break;
        case 'makeblock':
        case 'calcArg':
            this.docks.push([obj[1][1][0], obj[1][1][1], this.protoblock.dockTypes[1]]);
            for (var i = 2; i < obj[1].length; i++) {
                this.docks.push([obj[1][i][0], obj[1][i][1], 'anyin']);
            }
            break;
        default:
            break;
        }

        // Save new artwork and dock positions.
        this.artwork = obj[0];
        for (var i = 0; i < this.docks.length; i++) {
            this.docks[i][0] = obj[1][i][0];
            this.docks[i][1] = obj[1][i][1];
        }

        this.width = obj[2];
        this.height = obj[3];
        this.hitHeight = obj[4];
    };

    this.imageLoad = function () {
        // Load any artwork associated with the block and create any
        // extra parts. Image components are loaded asynchronously so
        // most the work happens in callbacks.

        // We need a text label for some blocks. For number and text
        // blocks, this is the primary label; for parameter blocks,
        // this is used to display the current block value.
        var fontSize = 10 * this.protoblock.scale;
        this.text = new createjs.Text('', fontSize + 'px Sans', '#000000');

        this.generateArtwork(true, []);
    };

    this._addImage = function () {
        var image = new Image();
        var that = this;

        image.onload = function () {
            var bitmap = new createjs.Bitmap(image);
            bitmap.name = 'media';
            that.container.addChild(bitmap);
            that._positionMedia(bitmap, image.width, image.height, that.protoblock.scale);
            that.imageBitmap = bitmap;
            that.updateCache();
        };

        image.src = this.image;
    };

    this.regenerateArtwork = function (collapse) {
        // Sometimes (in the case of namedboxes and nameddos) we need
        // to regenerate the artwork associated with a block.

        // First we need to remove the old artwork.
        if (this.bitmap != null) {
            this.container.removeChild(this.bitmap);
        }

        if (this.highlightBitmap != null) {
            this.container.removeChild(this.highlightBitmap);
        }

        if (collapse && this.collapseBitmap !== null) {
            this.collapseContainer.removeChild(this.collapseBitmap);
            this.collapseContainer.removeChild(this.expandBitmap);
            this.container.removeChild(this.collapseBlockBitmap);
            this.container.removeChild(this.highlightCollapseBlockBitmap);
        }

        // Then we generate new artwork.
        this.generateArtwork(false);
    };

    this.generateArtwork = function (firstTime) {
        // Get the block labels from the protoblock.
        var that = this;
        var thisBlock = this.blocks.blockList.indexOf(this);
        var block_label = '';

        // Create the highlight bitmap for the block.
        var __processHighlightBitmap = function (name, bitmap, that) {
            if (that.highlightBitmap != null) {
                that.container.removeChild(that.highlightBitmap);
            }

            that.highlightBitmap = bitmap;
            that.container.addChild(that.highlightBitmap);
            that.highlightBitmap.x = 0;
            that.highlightBitmap.y = 0;
            that.highlightBitmap.name = 'bmp_highlight_' + thisBlock;
            if (!that.blocks.logo.runningLilypond) {
                that.highlightBitmap.cursor = 'pointer';
            }
            // Hide highlight bitmap to start.
            that.highlightBitmap.visible = false;

            // At me point, it should be safe to calculate the
            // bounds of the container and cache its contents.
            if (!firstTime) {
                that.container.uncache();
            }

            __callback = function (that, firstTime) {
                that.blocks.refreshCanvas();
                var thisBlock = that.blocks.blockList.indexOf(that);

                if (firstTime) {
                    that._loadEventHandlers();
                    if (that.image !== null) {
                        that._addImage();
                    }

                    that._finishImageLoad();
                } else {
                    if (that.name === 'start' || that.name === 'drum') {
                        that._ensureDecorationOnTop();
                    }

                    // Adjust the docks.
                    that.blocks.adjustDocks(thisBlock, true);

                    // Adjust the text position.
                    that._positionText(that.protoblock.scale);

                    if (COLLAPSABLES.indexOf(that.name) !== -1) {
                        that.bitmap.visible = !that.collapsed;
                        that.highlightBitmap.visible = false;
                        that.updateCache();
                    }

                    if (that.postProcess != null) {
                        that.postProcess(that.postProcessArg);
                        that.postProcess = null;
                    }
                }
            };

            that._createCache(__callback, firstTime);
        };

        // Create the bitmap for the block.
        var __processBitmap = function (name, bitmap, that) {
            if (that.bitmap != null) {
                that.container.removeChild(that.bitmap);
            }

            that.bitmap = bitmap;
            that.container.addChild(that.bitmap);
            that.bitmap.x = 0;
            that.bitmap.y = 0;
            that.bitmap.name = 'bmp_' + thisBlock;
            that.bitmap.cursor = 'pointer';
            that.blocks.refreshCanvas();

            if (that.protoblock.disabled) {
                var artwork = that.artwork.replace(/fill_color/g, DISABLEDFILLCOLOR).replace(/stroke_color/g, DISABLEDSTROKECOLOR).replace('block_label', safeSVG(block_label));
            } else {
                var artwork = that.artwork.replace(/fill_color/g, PALETTEHIGHLIGHTCOLORS[that.protoblock.palette.name]).replace(/stroke_color/g, HIGHLIGHTSTROKECOLORS[that.protoblock.palette.name]).replace('block_label', safeSVG(block_label));
            }

            for (var i = 1; i < that.protoblock.staticLabels.length; i++) {
                artwork = artwork.replace('arg_label_' + i, that.protoblock.staticLabels[i]);
            }

            that.blocks.blockArt[that.blocks.blockList.indexOf(that)] = artwork;
            _makeBitmap(artwork, that.name, __processHighlightBitmap, that);
        };

        if (this.overrideName) {
            if (['storein2', 'nameddo', 'nameddoArg', 'namedcalc', 'namedcalcArg'].indexOf(this.name) !== -1) {
                block_label = this.overrideName;
                if (getTextWidth(block_label, 'bold 20pt Sans') > TEXTWIDTH) {
                    block_label = ' ' + block_label.substr(0, STRINGLEN) + '...';
                }
            } else {
                block_label = this.overrideName;
            }
        } else if (this.protoblock.staticLabels.length > 0 && !this.protoblock.image) {
            // Label should be defined inside _().
            block_label = this.protoblock.staticLabels[0];
        }

        while (this.protoblock.staticLabels.length < this.protoblock.args + 1) {
            this.protoblock.staticLabels.push('');
        }

        if (firstTime) {
            // Create artwork and dock.
            this.protoblock.scale = this.blocks.blockScale;

            var obj = this.protoblock.generator();
            this.artwork = obj[0];
            for (var i = 0; i < obj[1].length; i++) {
                this.docks.push([obj[1][i][0], obj[1][i][1], this.protoblock.dockTypes[i]]);
            }

            this.width = obj[2];
            this.height = obj[3];
            this.hitHeight = obj[4];
        }

        if (this.protoblock.disabled) {
            var artwork = this.artwork.replace(/fill_color/g, DISABLEDFILLCOLOR).replace(/stroke_color/g, DISABLEDSTROKECOLOR).replace('block_label', safeSVG(block_label));
        } else {
            var artwork = this.artwork.replace(/fill_color/g, PALETTEFILLCOLORS[this.protoblock.palette.name]).replace(/stroke_color/g, PALETTESTROKECOLORS[this.protoblock.palette.name]).replace('block_label', safeSVG(block_label));
        }

        for (var i = 1; i < this.protoblock.staticLabels.length; i++) {
            artwork = artwork.replace('arg_label_' + i, this.protoblock.staticLabels[i]);
        }

        _makeBitmap(artwork, this.name, __processBitmap, this);
    };

    this._finishImageLoad = function () {
        var thisBlock = this.blocks.blockList.indexOf(this);

        // Value blocks get a modifiable text label.
        if (SPECIALINPUTS.indexOf(this.name) !== -1) {
            if (this.value == null) {
                switch(this.name) {
                case 'text':
                    this.value = '---';
                    break;
                case 'solfege':
                case 'eastindiansolfege':
                    this.value = 'sol';
                    break;
                case 'notename':
                    this.value = 'G';
                    break;
                case 'rest':
                    this.value = _('rest');
                    break;
                case 'boolean':
                    this.value = true;
                    break;
                case 'number':
                    this.value = NUMBERBLOCKDEFAULT;
                    break;
                case 'modename':
                    this.value = getModeName(DEFAULTMODE);
                    break;
                case 'accidentalname':
                    this.value = DEFAULTACCIDENTAL;
                    break;
                case 'intervalname':
                    this.value = getIntervalName(DEFAULTINTERVAL);
                    break;
                case 'invertmode':
                    this.value = getInvertMode(DEFAULTINVERT);
                    break;
                case 'voicename':
                    this.value = getVoiceName(DEFAULTVOICE);
                    break;
                case 'drumname':
                    this.value = getDrumName(DEFAULTDRUM);
                    break;
                case 'filtertype':
                    this.value = getFilterTypes(DEFAULTFILTERTYPE);
                    break;
                case 'oscillatortype':
                    this.value = getOscillatorTypes(DEFAULTOSCILLATORTYPE);
                    break;
                case 'temperamentname':
                    this.value = 'equal';
                    break;
                }
            }

            if (this.name === 'solfege') {
                var obj = splitSolfege(this.value);
                var label = i18nSolfege(obj[0]);
                var attr = obj[1];

                if (attr !== '♮') {
                    label += attr;
                }
            } else if (this.name === 'eastindiansolfege') {
                var obj = splitSolfege(this.value);
                var label = WESTERN2EISOLFEGENAMES[obj[0]];
                var attr = obj[1];

                if (attr !== '♮') {
                    label += attr;
                }
            } else {
                if (this.value !== null) {
                    var label = this.value.toString();
                } else {
                    var label = '???';
                }
            }

            if (WIDENAMES.indexOf(this.name) === -1 && getTextWidth(label, 'bold 20pt Sans') > TEXTWIDTH ) {   
                label = label.substr(0, STRINGLEN) + '...';
            }

            this.text.text = label;
            this.container.addChild(this.text);
            this._positionText(this.protoblock.scale);
        } else if (this.protoblock.parameter) {
            // Parameter blocks get a text label to show their current value.
            this.container.addChild(this.text);
            this._positionText(this.protoblock.scale);
        }

        if (COLLAPSABLES.indexOf(this.name) === -1) {
            this.loadComplete = true;
            if (this.postProcess !== null) {
                this.postProcess(this.postProcessArg);
                this.postProcess = null;
            }

            this.blocks.refreshCanvas();
            this.blocks.cleanupAfterLoad(this.name);
            if (this.trash) {
                this.collapseContainer.visible = false;
                this.collapseText.visible = false;
            }
        } else {
            // Start blocks and Action blocks can collapse, so add an
            // event handler.
            var proto = new ProtoBlock('collapse');
            proto.scale = this.protoblock.scale;
            proto.extraWidth = 40;
            proto.basicBlockCollapsed();
            var obj = proto.generator();
            this.collapseArtwork = obj[0];
            var postProcess = function (that) {
                that._loadCollapsibleEventHandlers();
                that.loadComplete = true;

                if (that.postProcess !== null) {
                    that.postProcess(that.postProcessArg);
                    that.postProcess = null;
                }
            };

            this._generateCollapseArtwork(postProcess);
        }
    };

    this._generateCollapseArtwork = function (postProcess) {
        var that = this;
        var thisBlock = this.blocks.blockList.indexOf(this);

        var __processHighlightCollapseBitmap = function (name, bitmap, that) {
            that.highlightCollapseBlockBitmap = bitmap;
            that.highlightCollapseBlockBitmap.name = 'highlight_collapse_' + thisBlock;
            that.container.addChild(that.highlightCollapseBlockBitmap);
            that.highlightCollapseBlockBitmap.visible = false;

            if (that.collapseText === null) {
                var fontSize = 10 * that.protoblock.scale;
                switch (that.name) {
                case 'action':
                    that.collapseText = new createjs.Text(_('action'), fontSize + 'px Sans', '#000000');
                    break;
                case 'start':
                    that.collapseText = new createjs.Text(_('start'), fontSize + 'px Sans', '#000000');
                    break;
                case 'matrix':
                    that.collapseText = new createjs.Text(_('matrix'), fontSize + 'px Sans', '#000000');
                    break;
                case 'status':
                    that.collapseText = new createjs.Text(_('status'), fontSize + 'px Sans', '#000000');
                    break;
                case 'pitchdrummatrix':
                    that.collapseText = new createjs.Text(_('drum'), fontSize + 'px Sans', '#000000');
                    break;
                case 'rhythmruler':
                    that.collapseText = new createjs.Text(_('ruler'), fontSize + 'px Sans', '#000000');
                    break;
                case 'timbre':
                    that.collapseText = new createjs.Text(_('timbre'), fontSize + 'px Sans', '#000000');
                    break;
                case 'pitchstaircase':
                    that.collapseText = new createjs.Text(_('stair'), fontSize + 'px Sans', '#000000');
                    break;
                case 'tempo':
                    that.collapseText = new createjs.Text(_('tempo'), fontSize + 'px Sans', '#000000');
                    break;
                case 'modewidget':
                    that.collapseText = new createjs.Text(_('mode'), fontSize + 'px Sans', '#000000');
                    break;
                case 'pitchslider':
                    that.collapseText = new createjs.Text(_('slider'), fontSize + 'px Sans', '#000000');
                    break;
                case 'drum':
                    that.collapseText = new createjs.Text(_('drum'), fontSize + 'px Sans', '#000000');
                    break;
                }

                that.collapseText.textAlign = 'left';
                that.collapseText.textBaseline = 'alphabetic';
                that.container.addChild(that.collapseText);
            }

            that._positionCollapseLabel(that.protoblock.scale);
            that.collapseText.visible = that.collapsed;
            that._ensureDecorationOnTop();
            that.updateCache();

            that.collapseContainer = new createjs.Container();
            that.collapseContainer.snapToPixelEnabled = true;

            var image = new Image();
            image.onload = function () {
                that.collapseBitmap = new createjs.Bitmap(image);
                that.collapseBitmap.scaleX = that.collapseBitmap.scaleY = that.collapseBitmap.scale = that.protoblock.scale / 2;
                that.collapseContainer.addChild(that.collapseBitmap);
                that.collapseBitmap.visible = !that.collapsed;
                finishCollapseButton(that);
            };

            image.src = 'images/collapse.svg';

            finishCollapseButton = function (that) {
                var image = new Image();
                image.onload = function () {
                    that.expandBitmap = new createjs.Bitmap(image);
                    that.expandBitmap.scaleX = that.expandBitmap.scaleY = that.expandBitmap.scale = that.protoblock.scale / 2;
                    that.collapseContainer.addChild(that.expandBitmap);
                    that.expandBitmap.visible = that.collapsed;

                    var bounds = that.collapseContainer.getBounds();
                    that.collapseContainer.cache(bounds.x, bounds.y, bounds.width, bounds.height);
                    that.blocks.stage.addChild(that.collapseContainer);
                    if (postProcess !== null) {
                        postProcess(that);
                    }

                    that.blocks.refreshCanvas();
                    that.blocks.cleanupAfterLoad(that.name);
                    if (that.trash) {
                        that.collapseContainer.visible = false;
                        that.collapseText.visible = false;
                    }
                };

                image.src = 'images/expand.svg';
            }
        };

        var __processCollapseBitmap = function (name, bitmap, that) {
            that.collapseBlockBitmap = bitmap;
            that.collapseBlockBitmap.name = 'collapse_' + thisBlock;
            that.container.addChild(that.collapseBlockBitmap);
            that.collapseBlockBitmap.visible = that.collapsed;
            that.blocks.refreshCanvas();

            var artwork = that.collapseArtwork;
            _makeBitmap(artwork.replace(/fill_color/g, PALETTEHIGHLIGHTCOLORS[that.protoblock.palette.name]).replace(/stroke_color/g, HIGHLIGHTSTROKECOLORS[that.protoblock.palette.name]).replace('block_label', ''), '', __processHighlightCollapseBitmap, that);
        };

        var artwork = this.collapseArtwork;
        _makeBitmap(artwork.replace(/fill_color/g, PALETTEFILLCOLORS[this.protoblock.palette.name]).replace(/stroke_color/g, PALETTESTROKECOLORS[this.protoblock.palette.name]).replace('block_label', ''), '', __processCollapseBitmap, this);
    };

    this.hide = function () {
        this.container.visible = false;
        if (this.collapseContainer !== null) {
            this.collapseContainer.visible = false;
            this.collapseText.visible = false;
        }
    };

    this.show = function () {
        if (!this.trash) {
            // If it is an action block or it is not collapsed then show it.
            if (!(COLLAPSABLES.indexOf(this.name) === -1 && this.collapsed)) {
                this.container.visible = true;
                if (this.collapseContainer !== null) {
                    this.collapseContainer.visible = true;
                    this.collapseText.visible = true;
                }
            }
        }
    };

    // Utility functions
    this.isValueBlock = function () {
        return this.protoblock.style === 'value';
    };

    this.isNoHitBlock = function () {
        return NOHIT.indexOf(this.name) !== -1;
    };

    this.isArgBlock = function () {
        return this.protoblock.style === 'value' || this.protoblock.style === 'arg';
    };

    this.isTwoArgBlock = function () {
        return this.protoblock.style === 'twoarg';
    };

    this.isTwoArgBooleanBlock = function () {
        return ['equal', 'greater', 'less'].indexOf(this.name) !== -1;
    };

    this.isClampBlock = function () {
        return this.protoblock.style === 'clamp' || this.isDoubleClampBlock() || this.isArgFlowClampBlock();
    };

    this.isArgFlowClampBlock = function () {
        return this.protoblock.style === 'argflowclamp';
    };

    this.isDoubleClampBlock = function () {
        return this.protoblock.style === 'doubleclamp';
    };

    this.isNoRunBlock = function () {
        return this.name === 'action';
    };

    this.isArgClamp = function () {
        return this.protoblock.style === 'argclamp' || this.protoblock.style === 'argclamparg';
    };

    this.isExpandableBlock = function () {
        return this.protoblock.expandable;
    };

    this.getBlockId = function () {
        // Generate a UID based on the block index into the blockList.
        var number = blockBlocks.blockList.indexOf(this);
        return '_' + number.toString();
    };

    this.removeChildBitmap = function (name) {
        for (var child = 0; child < this.container.children.length; child++) {
            if (this.container.children[child].name === name) {
                this.container.removeChild(this.container.children[child]);
                break;
            }
        }
    };

    this.loadThumbnail = function (imagePath) {
        // Load an image thumbnail onto block.
        var thisBlock = this.blocks.blockList.indexOf(this);
        var that = this;
        if (this.blocks.blockList[thisBlock].value === null && imagePath === null) {
            return;
        }
        var image = new Image();

        image.onload = function () {
            // Before adding new artwork, remove any old artwork.
            that.removeChildBitmap('media');

            var bitmap = new createjs.Bitmap(image);
            bitmap.name = 'media';


            var myContainer = new createjs.Container();
            myContainer.addChild(bitmap);

            // Resize the image to a reasonable maximum.
            var MAXWIDTH = 600;
            var MAXHEIGHT = 450;
            if (image.width > image.height) {
                if (image.width > MAXWIDTH) {
                    bitmap.scaleX = bitmap.scaleY = bitmap.scale = MAXWIDTH / image.width;
                }
            } else {
                if (image.height > MAXHEIGHT) {
                    bitmap.scaleX = bitmap.scaleY = bitmap.scale = MAXHEIGHT / image.height;
                }
            }

            var bounds = myContainer.getBounds();
            myContainer.cache(bounds.x, bounds.y, bounds.width, bounds.height);
            that.value = myContainer.bitmapCache.getCacheDataURL();
            that.imageBitmap = bitmap;

            // Next, scale the bitmap for the thumbnail.
            that._positionMedia(bitmap, bitmap.image.width, bitmap.image.height, that.protoblock.scale);
            that.container.addChild(bitmap);
            that.updateCache();
        };

        if (imagePath === null) {
            image.src = this.value;
        } else {
            image.src = imagePath;
        }
    };

    this._doOpenMedia = function (thisBlock) {
        var fileChooser = docById('myOpenAll');
        var that = this;

        var __readerAction = function (event) {
            window.scroll(0, 0);

            var reader = new FileReader();
            reader.onloadend = (function () {
                if (reader.result) {
                    if (that.name === 'media') {
                        that.value = reader.result;
                        that.loadThumbnail(null);
                        return;
                    }
                    that.value = [fileChooser.files[0].name, reader.result];
                    that.blocks.updateBlockText(thisBlock);
                }
            });
            if (that.name === 'media') {
                reader.readAsDataURL(fileChooser.files[0]);
            }
            else {
                reader.readAsText(fileChooser.files[0]);
            }
            fileChooser.removeEventListener('change', __readerAction);
        };

        fileChooser.addEventListener('change', __readerAction, false);
        fileChooser.focus();
        fileChooser.click();
        window.scroll(0, 0)
    };

    this.collapseToggle = function () {
        // Find the blocks to collapse/expand
        var that = this;
        var thisBlock = this.blocks.blockList.indexOf(this);
        this.blocks.findDragGroup(thisBlock);

        var __toggle = function () {
            var collapse = that.collapsed;
            if (that.collapseBitmap === null) {
                console.log('collapse bitmap not ready');
                return;
            }
            that.collapsed = !collapse;

            // These are the buttons to collapse/expand the stack.
            that.collapseBitmap.visible = collapse;
            that.expandBitmap.visible = !collapse;

            // These are the collpase-state bitmaps.
            that.collapseBlockBitmap.visible = !collapse;
            that.highlightCollapseBlockBitmap.visible = false;
            that.collapseText.visible = !collapse;

            if (collapse) {
                that.bitmap.visible = true;
            } else {
                that.bitmap.visible = false;
                that.updateCache();
            }
            that.highlightBitmap.visible = false;

            if (that.name === 'action') {
                // Label the collapsed block with the action label
                if (that.connections[1] !== null) {
                    var text = that.blocks.blockList[that.connections[1]].value;
                    if (getTextWidth(text, 'bold 20pt Sans') > TEXTWIDTH) {
                        text = text.substr(0, STRINGLEN) + '...';
                    }

                    that.collapseText.text = text;
                } else {
                    that.collapseText.text = '';
                }
            }

            // Make sure the text is on top.
            var z = that.container.children.length - 1;
            that.container.setChildIndex(that.collapseText, z);

            // Set collapsed state of blocks in drag group.
            if (that.blocks.dragGroup.length > 0) {
                for (var b = 1; b < that.blocks.dragGroup.length; b++) {
                    var blk = that.blocks.dragGroup[b];
                    that.blocks.blockList[blk].collapsed = !collapse;
                    that.blocks.blockList[blk].container.visible = collapse;
                }
            }

            that.collapseContainer.updateCache();
            that.updateCache();
        }

        __toggle();
    };

    this._positionText = function (blockScale) {
        this.text.textBaseline = 'alphabetic';
        this.text.textAlign = 'right';
        var fontSize = 10 * blockScale;
        this.text.font = fontSize + 'px Sans';
        this.text.x = TEXTX * blockScale / 2.;
        this.text.y = TEXTY * blockScale / 2.;

        // Some special cases
        if (SPECIALINPUTS.indexOf(this.name) !== -1) {
            this.text.textAlign = 'center';
            this.text.x = VALUETEXTX * blockScale / 2.;
            if (EXTRAWIDENAMES.indexOf(this.name) !== -1) {
                this.text.x *= 3.0;
            } else if (WIDENAMES.indexOf(this.name) !== -1) {
                this.text.x *= 1.75;
            } else if (this.name === 'text') {
                this.text.x = this.width / 2;
            }
        } else if (this.name === 'nameddo') {
            this.text.textAlign = 'center';
            this.text.x = this.width / 2;
        } else if (this.protoblock.args === 0) {
            var bounds = this.container.getBounds();
            this.text.x = this.width - 25;
        } else {
            this.text.textAlign = 'left';
            if (this.docks[0][2] === 'booleanout') {
                this.text.y = this.docks[0][1];
            }
        }

        // Ensure text is on top.
        z = this.container.children.length - 1;
        this.container.setChildIndex(this.text, z);
        this.updateCache();
    };

    this._positionMedia = function (bitmap, width, height, blockScale) {
        if (width > height) {
            bitmap.scaleX = bitmap.scaleY = bitmap.scale = MEDIASAFEAREA[2] / width * blockScale / 2;
        } else {
            bitmap.scaleX = bitmap.scaleY = bitmap.scale = MEDIASAFEAREA[3] / height * blockScale / 2;
        }
        bitmap.x = (MEDIASAFEAREA[0] - 10) * blockScale / 2;
        bitmap.y = MEDIASAFEAREA[1] * blockScale / 2;
    };

    this._calculateCollapseHitArea = function () {
        var hitArea = new createjs.Shape();
        var w2 = STANDARDBLOCKHEIGHT * this.collapseBitmap.scaleX;
        var h2 = this.hitHeight;

        hitArea.graphics.beginFill('#FFF').drawRect(0, 0, w2, h2);
        hitArea.x = 0;
        hitArea.y = 0;
        this.collapseContainer.hitArea = hitArea;
    };

    this._positionCollapseLabel = function (blockScale) {
        this.collapseText.x = COLLAPSETEXTX * blockScale / 2;
        this.collapseText.y = COLLAPSETEXTY * blockScale / 2;

        // Ensure text is on top.
        z = this.container.children.length - 1;
        this.container.setChildIndex(this.collapseText, z);
    };

    this._positionCollapseContainer = function (blockScale) {
        this.collapseContainer.x = this.container.x + (COLLAPSEBUTTONXOFF * blockScale / 2);
        this.collapseContainer.y = this.container.y + (COLLAPSEBUTTONYOFF * blockScale / 2);
    };

    // These are the event handlers for collapsible blocks.
    this._loadCollapsibleEventHandlers = function () {
        var that = this;
        var thisBlock = this.blocks.blockList.indexOf(this);

        this._calculateCollapseHitArea();

        this.collapseContainer.on('mouseover', function (event) {
            if (!that.blocks.logo.runningLilypond) {
                document.body.style.cursor = 'pointer';
            }
            that.blocks.highlight(thisBlock, true);
            that.blocks.activeBlock = thisBlock;
            that.blocks.refreshCanvas();
        });

        var haveClick = false;
        var moved = false;
        var locked = false;
        var sawMouseDownEvent = false;

        this.collapseContainer.on('click', function (event) {
            that.blocks.activeBlock = thisBlock;
            haveClick = true;

            if (locked) {
                return;
            }

            locked = true;
            setTimeout(function () {
                locked = false;
            }, 500);

            hideDOMLabel();

            if (!moved) {
                that.collapseToggle();
                // haveClick = false;
            }
        });

        this.collapseContainer.on('mousedown', function (event) {
            sawMouseDownEvent = true;
            // Always show the trash when there is a block selected,
            trashcan.show();

            // Raise entire stack to the top.
            that.blocks.raiseStackToTop(thisBlock);
            // And the collapse button
            that.blocks.stage.setChildIndex(that.collapseContainer, that.blocks.stage.children.length - 1);
            moved = false;
            var original = {
                x: event.stageX / that.blocks.getStageScale(),
                y: event.stageY / that.blocks.getStageScale()
            };

            var offset = {
                x: Math.round(that.collapseContainer.x - original.x),
                y: Math.round(that.collapseContainer.y - original.y)
            };

            that.collapseContainer.removeAllEventListeners('mouseout');
            that.collapseContainer.on('mouseout', function (event) {
                that._collapseOut(event, moved, haveClick);
                moved = false;
                sawMouseDownEvent = false;
            });

            that.collapseContainer.removeAllEventListeners('pressup');
            that.collapseContainer.on('pressup', function (event) {
                // if (sawMouseDownEvent && haveClick) {
                //     return;
                // }

                if (!sawMouseDownEvent && !moved) {
                    // Sometimes we don't see a mousedown event, so
                    // treat this like a click.
                    that.collapseToggle();
                } else {
                    that._collapseOut(event, moved, haveClick, true);
                }
                moved = false;
                sawMouseDownEvent = false;
            });

            that.collapseContainer.removeAllEventListeners('pressmove');
            that.collapseContainer.on('pressmove', function (event) {
                // FIXME: More voodoo
                event.nativeEvent.preventDefault();
                moved = true;

                var oldX = that.collapseContainer.x;
                var oldY = that.collapseContainer.y;

                var dx = Math.round(event.stageX / that.blocks.getStageScale() + offset.x - oldX);
                var dy = Math.round(event.stageY / that.blocks.getStageScale() + offset.y - oldY);


                var finalPos = oldY + dy;
                if (that.blocks.stage.y === 0 && finalPos < 45) {
                    dy += 45 - finalPos;
                }

                if (that.blocks.longPressTimeout != null) {
                    clearTimeout(that.blocks.longPressTimeout);
                    that.blocks.longPressTimeout = null;
                    that.blocks.clearLongPressButtons();
                }

                that.blocks.moveBlockRelative(thisBlock, dx, dy);

                // If we are over the trash, warn the user.
                if (trashcan.overTrashcan(event.stageX / that.blocks.getStageScale(), event.stageY / that.blocks.getStageScale())) {
                    trashcan.startHighlightAnimation();
                } else {
                    trashcan.stopHighlightAnimation();
                }

                that._positionCollapseContainer(that.protoblock.scale);

                // ...and move any connected blocks.
                that.blocks.findDragGroup(thisBlock)
                if (that.blocks.dragGroup.length > 0) {
                    for (var b = 0; b < that.blocks.dragGroup.length; b++) {
                        var blk = that.blocks.dragGroup[b];
                        if (b !== 0) {
                            that.blocks.moveBlockRelative(blk, dx, dy);
                        }
                    }
                }

                that.blocks.refreshCanvas();
                sawMouseDownEvent = false;
            });
        });
    };

    this._collapseOut = function (event, moved, haveClick) {
        var thisBlock = this.blocks.blockList.indexOf(this);
        if (!this.blocks.logo.runningLilypond) {
            document.body.style.cursor = 'default';
        }

        // Always hide the trash when there is no block selected.
        trashcan.hide();
        this.blocks.unhighlight(thisBlock);
        if (moved) {
            // Check if block is in the trash.
            if (trashcan.overTrashcan(event.stageX / this.blocks.getStageScale(), event.stageY / this.blocks.getStageScale())) {
                if (trashcan.isVisible)
                    this.blocks.sendStackToTrash(this);
            } else {
                // Otherwise, process move.
                this.blocks.blockMoved(thisBlock);
            }
        }

        if (this.blocks.activeBlock !== this) {
            return;
        }

        this.blocks.unhighlight(null);
        this.blocks.activeBlock = null;
        this.blocks.refreshCanvas();
    };

    this._calculateBlockHitArea = function () {
        var hitArea = new createjs.Shape();
        hitArea.graphics.beginFill('#FFF').drawRect(0, 0, this.width, this.hitHeight);
        this.container.hitArea = hitArea;
    };

    // These are the event handlers for block containers.
    this._loadEventHandlers = function () {
        var that = this;
        var thisBlock = this.blocks.blockList.indexOf(this);

        this._calculateBlockHitArea();

        this.container.on('mouseover', function (event) {
            if (!that.blocks.logo.runningLilypond) {
                document.body.style.cursor = 'pointer';
            }

            that.blocks.highlight(thisBlock, true);
            that.blocks.activeBlock = thisBlock;
            that.blocks.refreshCanvas();
        });

        var haveClick = false;
        var moved = false;
        var locked = false;
        var getInput = window.hasMouse;

        this.container.on('click', function (event) {
            that.blocks.activeBlock = thisBlock;
            haveClick = true;

            if (locked) {
                return;
            }

            locked = true;
            setTimeout(function () {
                locked = false;
            }, 500);

            hideDOMLabel();

            if ((!window.hasMouse && getInput) || (window.hasMouse && !moved)) {
                if (that.name === 'media') {
                    that._doOpenMedia(thisBlock);
                } else if (that.name === 'loadFile') {
                    that._doOpenMedia(thisBlock);
                } else if (SPECIALINPUTS.indexOf(that.name) !== -1) {
                    if (!that.trash) {
                        that._changeLabel();
                    }
                } else {
                    if (!that.blocks.getLongPressStatus()) {
                        var topBlock = that.blocks.findTopBlock(thisBlock);
                        console.log('running from ' + that.blocks.blockList[topBlock].name);
                        if (_THIS_IS_MUSIC_BLOCKS_) {
                            that.blocks.logo.synth.resume();
                        }

                        if (that.blocks.turtles.running()) {
                            that.blocks.logo.doStopTurtle();

                            setTimeout(function () {
                                that.blocks.logo.runLogoCommands(topBlock);
                            }, 250);
                        } else {
                            that.blocks.logo.runLogoCommands(topBlock);
                        }
                    }
                }
            }
        });

        this.container.on('mousedown', function (event) {
            // Track time for detecting long pause...
            // but only for top block in stack.
            if (that.connections[0] == null) {
                var d = new Date();
                that.blocks.mouseDownTime = d.getTime();

                that.blocks.longPressTimeout = setTimeout(function () {
                    that.blocks.activeBlock = that.blocks.blockList.indexOf(that);
                    that.blocks.triggerLongPress();
                }, LONGPRESSTIME);
            }

            // Always show the trash when there is a block selected,
            trashcan.show();

            // Raise entire stack to the top.
            that.blocks.raiseStackToTop(thisBlock);

            // And possibly the collapse button.
            if (that.collapseContainer != null) {
                that.blocks.stage.setChildIndex(that.collapseContainer, that.blocks.stage.children.length - 1);
            }

            moved = false;
            var original = {
                x: event.stageX / that.blocks.getStageScale(),
                y: event.stageY / that.blocks.getStageScale()
            };

            var offset = {
                x: Math.round(that.container.x - original.x),
                y: Math.round(that.container.y - original.y)
            };

            that.container.removeAllEventListeners('mouseout');
            that.container.on('mouseout', function (event) {
                if (!that.blocks.logo.runningLilypond) {
                    document.body.style.cursor = 'default';
                }

                if (!that.blocks.getLongPressStatus()) {
                    that._mouseoutCallback(event, moved, haveClick, false);
                }

                moved = false;
            });

            that.container.removeAllEventListeners('pressup');
            that.container.on('pressup', function (event) {
                if (!that.blocks.getLongPressStatus()) {
                    that._mouseoutCallback(event, moved, haveClick, true);
                }

                moved = false;
            });

            that.container.removeAllEventListeners('pressmove');
            that.container.on('pressmove', function (event) {
                // FIXME: More voodoo
                event.nativeEvent.preventDefault();

                // Don't allow silence block to be dragged out of a note.
                if (that.name === 'rest2') {
                    return;
                }

                if (window.hasMouse) {
                    moved = true;
                } else {
                    // Make it eaiser to select text on mobile.
                    setTimeout(function () {
                        moved = Math.abs(event.stageX / that.blocks.getStageScale() - original.x) + Math.abs(event.stageY / that.blocks.getStageScale() - original.y) > 20 && !window.hasMouse;
                        getInput = !moved;
                    }, 200);
                }

                var oldX = that.container.x;
                var oldY = that.container.y;

                var dx = Math.round(event.stageX / that.blocks.getStageScale() + offset.x - oldX);
                var dy = Math.round(event.stageY / that.blocks.getStageScale() + offset.y - oldY);

                var finalPos = oldY + dy;
                if (that.blocks.stage.y === 0 && finalPos < 45) {
                    dy += 45 - finalPos;
                }

                // Add some wiggle room for longPress.
                // if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {

                if (that.blocks.longPressTimeout != null) {
                    clearTimeout(that.blocks.longPressTimeout);
                    that.blocks.longPressTimeout = null;
                    that.blocks.clearLongPressButtons();
                }

                if (!moved && that.label != null) {
                    that.label.style.display = 'none';
                }

                that.blocks.moveBlockRelative(thisBlock, dx, dy);

                // If we are over the trash, warn the user.
                if (trashcan.overTrashcan(event.stageX / that.blocks.getStageScale(), event.stageY / that.blocks.getStageScale())) {
                    trashcan.startHighlightAnimation();
                } else {
                    trashcan.stopHighlightAnimation();
                }

                if (that.isValueBlock() && that.name !== 'media') {
                    // Ensure text is on top
                    var z = that.container.children.length - 1;
                    that.container.setChildIndex(that.text, z);
                } else if (that.collapseContainer != null) {
                    that._positionCollapseContainer(that.protoblock.scale);
                }

                // ...and move any connected blocks.
                that.blocks.findDragGroup(thisBlock)
                if (that.blocks.dragGroup.length > 0) {
                    for (var b = 0; b < that.blocks.dragGroup.length; b++) {
                        var blk = that.blocks.dragGroup[b];
                        if (b !== 0) {
                            that.blocks.moveBlockRelative(blk, dx, dy);
                        }
                    }
                }

                that.blocks.refreshCanvas();

                // } else {
                    // Didn't really move enough to be considered a move.
                    // moved = false;
                // }
            });
        });

        this.container.on('mouseout', function (event) {
            if (!that.blocks.getLongPressStatus()) {
                that._mouseoutCallback(event, moved, haveClick, false);
            } else {
                that.blocks.clearLongPressButtons();
            }

            moved = false;
        });

        this.container.on('pressup', function (event) {
            if (!that.blocks.getLongPressStatus()) {
                that._mouseoutCallback(event, moved, haveClick, false);
            } else {
                that.blocks.clearLongPressButtons();
            }

            moved = false;
        });
    };

    this._mouseoutCallback = function (event, moved, haveClick, hideDOM) {
        var thisBlock = this.blocks.blockList.indexOf(this);
        if (!this.blocks.logo.runningLilypond) {
            document.body.style.cursor = 'default';
        }

        // Always hide the trash when there is no block selected.
        trashcan.hide();

        if (this.blocks.longPressTimeout != null) {
            clearTimeout(this.blocks.longPressTimeout);
            this.blocks.longPressTimeout = null;
            this.blocks.clearLongPressButtons();
        }

        if (moved) {
            // Check if block is in the trash.
            if (trashcan.overTrashcan(event.stageX / this.blocks.getStageScale(), event.stageY / this.blocks.getStageScale())) {
                if (trashcan.isVisible) {
                    this.blocks.sendStackToTrash(this);
                }
            } else {
                // Otherwise, process move.
                // Also, keep track of the time of the last move.
                var d = new Date();
                this.blocks.mouseDownTime = d.getTime();
                this.blocks.blockMoved(thisBlock);

                // Just in case the blocks are not properly docked after
                // the move (workaround for issue #38 -- Blocks fly
                // apart). Still need to get to the root cause.
                this.blocks.adjustDocks(this.blocks.blockList.indexOf(this), true);
            }
        } else if (SPECIALINPUTS.indexOf(this.name) !== -1 || ['media', 'loadFile'].indexOf(this.name) !== -1) {
            if (!haveClick) {
                // Simulate click on Android.
                var d = new Date();
                if ((d.getTime() - this.blocks.mouseDownTime) < 500) {
                    if (!this.trash)
                    {
                        var d = new Date();
                        this.blocks.mouseDownTime = d.getTime();
                        if (this.name === 'media' || this.name === 'loadFile') {
                            this._doOpenMedia(thisBlock);
                        } else {
                            this._changeLabel();
                        }
                    }
                }
            }
        }

        if (hideDOM) {
            // Did the mouse move out off the block? If so, hide the
            // label DOM element.
            if ((event.stageX / this.blocks.getStageScale() < this.container.x || event.stageX / this.blocks.getStageScale() > this.container.x + this.width || event.stageY < this.container.y || event.stageY > this.container.y + this.hitHeight)) {
                if (PIEMENUS.indexOf(this.name) === -1 && !this._octaveNumber()) {
                    this._labelChanged();
                    hideDOMLabel();
                }

                this.blocks.unhighlight(null);
                this.blocks.refreshCanvas();
            } else if (this.blocks.activeBlock !== thisBlock) {
                // Are we in a different block altogether?
                hideDOMLabel();
                this.blocks.unhighlight(null);
                this.blocks.refreshCanvas();
            } else {
                // this.blocks.unhighlight(null);
                // this.blocks.refreshCanvas();
            }

            this.blocks.activeBlock = null;
        }
    };

    this._ensureDecorationOnTop = function () {
        // Find the turtle decoration and move it to the top.
        for (var child = 0; child < this.container.children.length; child++) {
            if (this.container.children[child].name === 'decoration') {
                // Drum block in collapsed state is less wide.
                var dx = 0;
                if (this.name === 'drum' && this.collapsed) {
                    var dx = 25 * this.protoblock.scale / 2;
                }

                for (var turtle = 0; turtle < this.blocks.turtles.turtleList.length; turtle++) {
                    if (this.blocks.turtles.turtleList[turtle].startBlock === this) {
                        this.blocks.turtles.turtleList[turtle].decorationBitmap.x = this.width - dx - 30 * this.protoblock.scale / 2;
                        break;
                    }
                }

                this.container.setChildIndex(this.container.children[child], this.container.children.length - 1);
                break;
            }
        }
    };

    this._changeLabel = function () {
        var that = this;
        var x = this.container.x;
        var y = this.container.y;

        var canvasLeft = this.blocks.canvas.offsetLeft + 28 * this.blocks.blockScale;
        var canvasTop = this.blocks.canvas.offsetTop + 6 * this.blocks.blockScale;

        var selectorWidth = 150;

        var movedStage = false;
        if (!window.hasMouse && this.blocks.stage.y + y > 75) {
            movedStage = true;
            var fromY = this.blocks.stage.y;
            this.blocks.stage.y = -y + 75;
        }

        // A place in the DOM to put modifiable labels (textareas).
        if (this.label != null) {
            var labelValue = this.label.value
        } else {
            var labelValue = this.value;
        }

        var labelElem = docById('labelDiv');

        if (this.name === 'text') {
            labelElem.innerHTML = '<input id="textLabel" style="position: absolute; -webkit-user-select: text;-moz-user-select: text;-ms-user-select: text;" class="text" type="text" value="' + labelValue + '" />';
            labelElem.classList.add('hasKeyboard');
            this.label = docById('textLabel');
        } else if (this.name === 'solfege') {
            var obj = splitSolfege(this.value);

            // solfnotes_ is used in the interface for internationalization.
            //.TRANS: the note names must be separated by single spaces
            var solfnotes_ = _('ti la sol fa mi re do').split(' ');

            this._piemenuPitches(solfnotes_, SOLFNOTES, SOLFATTRS, obj[0], obj[1]);
        } else if (this.name === 'eastindiansolfege') {
            var obj = splitSolfege(this.value);
            var selectednote = obj[0];
            var selectedattr = obj[1];

            this._piemenuPitches(EASTINDIANSOLFNOTES, SOLFNOTES, SOLFATTRS, obj[0], obj[1]);
        } else if (this.name === 'notename') {
            const NOTENOTES = ['B', 'A', 'G', 'F', 'E', 'D', 'C'];
            if (this.value != null) {
                var selectednote = this.value[0];
                if (this.value.length === 1) {
                    var selectedattr = '♮';
                } else if (this.value.length === 2) {
                    var selectedattr = this.value[1];
                } else {
                    var selectedattr = this.value[1] + this.value[2];
                }
            } else {
                var selectednote = 'G';
                var selectedattr = '♮'
            }

            if (selectedattr === '') {
                selectedattr = '♮';
            }

            this._piemenuPitches(NOTENOTES, NOTENOTES, SOLFATTRS, selectednote, selectedattr);
        } else if (this.name === 'modename') {
            if (this.value != null) {
                var selectedmode = this.value;
            } else {
                var selectedmode = getModeName(DEFAULTMODE);
            }

            this._piemenuModes(selectedmode);
        } else if (this.name === 'accidentalname') {
            if (this.value != null) {
                var selectedaccidental = this.value;
            } else {
                var selectedaccidental = DEFAULTACCIDENTAL;
            }

            this._piemenuAccidentals(ACCIDENTALLABELS, ACCIDENTALNAMES, selectedaccidental);

            // labelElem.innerHTML = '';
            // this.label = docById('accidentalnameLabel');
        } else if (this.name === 'intervalname') {
            if (this.value != null) {
                var selectedinterval = this.value;
            } else {
                var selectedinterval = getIntervalName(DEFAULTINTERVAL);
            }

            this._piemenuIntervals(selectedinterval);
        } else if (this.name === 'invertmode') {
            if (this.value != null) {
                var selectedinvert = this.value;
            } else {
                var selectedinvert = getInvertMode(DEFAULTINVERT);
            }

            var invertLabels = [];
            var invertValues = [];

            for (var i = 0; i < INVERTMODES.length; i++) {
                invertLabels.push(INVERTMODES[i][0]);
                invertValues.push(INVERTMODES[i][1]);
            }

            this._piemenuBasic(invertLabels, invertValues, selectedinvert);
        } else if (this.name === 'drumname') {
            if (this.value != null) {
                var selecteddrum = getDrumName(this.value);
            } else {
                var selecteddrum = getDrumName(DEFAULTDRUM);
            }

            var drumLabels = [];
            var drumValues = [];            
            var categories = [];
            var categoriesList = [];
            for (var i = 0; i < DRUMNAMES.length; i++) {
                if (getTextWidth(DRUMNAMES[i][0], 'bold 48pt Sans') > 400) {
                    drumLabels.push(DRUMNAMES[i][0].substr(0, 8) + '...');
                } else {
                    drumLabels.push(DRUMNAMES[i][0]);
                }

                drumValues.push(DRUMNAMES[i][1]);

                if (categoriesList.indexOf(DRUMNAMES[i][4]) === -1) {
                    categoriesList.push(DRUMNAMES[i][4]);
                }

                categories.push(categoriesList.indexOf(DRUMNAMES[i][4]));
            }

            this._piemenuVoices(drumLabels, drumValues, categories, selecteddrum);
        } else if (this.name === 'filtertype') {
            if (this.value != null) {
                var selectedtype = getFilterTypes(this.value);
            } else {
                var selectedtype = getFilterTypes(DEFAULTFILTERTYPE);
            }

            var filterLabels = [];
            var filterValues = [];
            for (var i = 0; i < FILTERTYPES.length; i++) {
                filterLabels.push(FILTERTYPES[i][0]);
                filterValues.push(FILTERTYPES[i][1]);
            }

            this._piemenuBasic(filterLabels, filterValues, selectedtype, ['#3ea4a3', '#60bfbc', '#1d8989', '#60bfbc', '#1d8989']);
        } else if (this.name === 'oscillatortype') {
            if (this.value != null) {
                var selectedtype = getOscillatorTypes(this.value);
            } else {
                var selectedtype = getOscillatorTypes(DEFAULTOSCILLATORTYPE);
            }

            var oscLabels = [];
            var oscValues = [];
            for (var i = 0; i < OSCTYPES.length; i++) {
                oscLabels.push(OSCTYPES[i][0]);
                oscValues.push(OSCTYPES[i][1]);
            }

            this._piemenuBasic(oscLabels, oscValues, selectedtype, ['#3ea4a3', '#60bfbc', '#1d8989', '#60bfbc', '#1d8989']);
        } else if (this.name === 'voicename') {
            if (this.value != null) {
                var selectedvoice = getVoiceName(this.value);
            } else {
                var selectedvoice = getVoiceName(DEFAULTVOICE);
            }

            var voiceLabels = [];
            var voiceValues = [];            
            var categories = [];
            var categoriesList = [];
            for (var i = 0; i < VOICENAMES.length; i++) {
                if (getTextWidth(VOICENAMES[i][0], 'bold 48pt Sans') > 400) {
                    voiceLabels.push(VOICENAMES[i][0].substr(0, 8) + '...');
                } else {
                    voiceLabels.push(VOICENAMES[i][0]);
                }

                voiceValues.push(VOICENAMES[i][1]);

                if (categoriesList.indexOf(VOICENAMES[i][3]) === -1) {
                    categoriesList.push(VOICENAMES[i][3]);
                }

                categories.push(categoriesList.indexOf(VOICENAMES[i][3]));
            }

            this._piemenuVoices(voiceLabels, voiceValues, categories, selectedvoice);
        } else if (this.name === 'temperamentname') {
            if (this.value != null) {
                var selectedTemperament = getTemperamentName(this.value);
            } else {
                var selectedTemperament = getTemperamentName(DEFAULTTEMPERAMENT);
            }

            var temperamentLabels = [];
            var temperamentValues = [];
            for (var i = 0; i < TEMPERAMENTS.length; i++) {
                temperamentLabels.push(TEMPERAMENTS[i][0]);
                temperamentValues.push(TEMPERAMENTS[i][1]);
            }

            this._piemenuBasic(temperamentLabels, temperamentValues, selectedTemperament, ['#3ea4a3', '#60bfbc', '#1d8989', '#60bfbc', '#1d8989']);
        } else if (this.name === 'boolean') {
            if (this.value != null) {
                var selectedvalue = this.value;
            } else {
                var selectedvalue = true;
            }

            var booleanLabels = [_('true'), _('false')];
            var booleanValues = ['true', 'false'];

            this._piemenuBoolean(booleanLabels, booleanValues, selectedvalue);
        } else {
            // If the number block is connected to a pitch block, then
            // use the pie menu for octaves.
            if (this._octaveNumber()) {
                this._piemenuOctave(this.value);
            } else {
                labelElem.innerHTML = '<input id="numberLabel" style="position: absolute; -webkit-user-select: text;-moz-user-select: text;-ms-user-select: text;" class="number" type="number" value="' + labelValue + '" />';
                labelElem.classList.add('hasKeyboard');
                this.label = docById('numberLabel');
            }
        }

        if (PIEMENUS.indexOf(this.name) === -1 && !this._octaveNumber()) {
            var focused = false;

            var __blur = function (event) {
                // Not sure why the change in the input is not available
                // immediately in FireFox. We need a workaround if hardware
                // acceleration is enabled.

                if (!focused) {
                    return;
                }

                that._labelChanged();

                event.preventDefault();

                labelElem.classList.remove('hasKeyboard');

                window.scroll(0, 0);
                that.label.removeEventListener('keypress', __keypress);

                if (movedStage) {
                    that.blocks.stage.y = fromY;
                    that.blocks.updateStage();
                }
            };

            if (this.name === 'text' || this.name === 'number') {
                this.label.addEventListener('blur', __blur);
            }

            var __keypress = function (event) {
                if ([13, 10, 9].indexOf(event.keyCode) !== -1) {
                    __blur(event);
                }
            };

            this.label.addEventListener('keypress', __keypress);

            this.label.addEventListener('change', function () {
                that._labelChanged();
            });

            this.label.style.left = Math.round((x + this.blocks.stage.x) * this.blocks.getStageScale() + canvasLeft) + 'px';
            this.label.style.top = Math.round((y + this.blocks.stage.y) * this.blocks.getStageScale() + canvasTop) + 'px';
            this.label.style.width = Math.round(selectorWidth * this.blocks.blockScale) * this.protoblock.scale / 2 + 'px';

            this.label.style.fontSize = Math.round(20 * this.blocks.blockScale * this.protoblock.scale / 2) + 'px';
            this.label.style.display = '';
            this.label.focus();
            if (this.labelattr != null) {
                this.labelattr.style.display = '';
            }

            // Firefox fix
            setTimeout(function () {
                that.label.style.display = '';
                that.label.focus();
                focused = true;
            }, 100);
        }
    };

    this._octaveNumber = function () {
        // Is this a number block being used as an octave argument?
        return (this.name === 'number' && this.connections[0] !== null && ['pitch', 'setpitchnumberoffset', 'invert1', 'tofrequency'].indexOf(this.blocks.blockList[this.connections[0]].name) !== -1 && this.blocks.blockList[this.connections[0]].connections[2] === this.blocks.blockList.indexOf(this));
    };

    this._piemenuPitches = function (noteLabels, noteValues, accidentals, note, accidental) {
        // wheelNav pie menu for pitch selection

        // Some blocks have both pitch and octave, so we can modify
        // both at once.
        var hasOctaveWheel = (this.connections[0] !== null && ['pitch', 'setpitchnumberoffset', 'invert1', 'tofrequency'].indexOf(this.blocks.blockList[this.connections[0]].name) !== -1);

        // If we are attached to a sset key block, we want to order
        // pitch by fifths.
        if (this.connections[0] !== null && ['setkey', 'setkey2'].indexOf(this.blocks.blockList[this.connections[0]].name) !== -1) {
            noteLabels = ['C', 'G', 'D', 'A', 'E', 'B', 'F'];
            noteValues = ['C', 'G', 'D', 'A', 'E', 'B', 'F'];
        }

        docById('wheelDiv').style.display = '';
        docById('wheelDiv').style.backgroundColor = '#c0c0c0';

        // the pitch selector
        this._pitchWheel = new wheelnav('wheelDiv', null, 600, 600);

        // the accidental selector
        this._accidentalsWheel = new wheelnav('_accidentalsWheel', this._pitchWheel.raphael);
        // the octave selector
        if (hasOctaveWheel) {
            this._octavesWheel = new wheelnav('_octavesWheel', this._pitchWheel.raphael);
        }

        // exit button
        this._exitWheel = new wheelnav('_exitWheel', this._pitchWheel.raphael);

        wheelnav.cssMode = true;

        this._pitchWheel.keynavigateEnabled = true;

        this._pitchWheel.colors = ['#77c428', '#93e042', '#77c428', '#5ba900', '#77c428', '#93e042', '#adfd55'];
        this._pitchWheel.slicePathFunction = slicePath().DonutSlice;
        this._pitchWheel.slicePathCustom = slicePath().DonutSliceCustomization();
        this._pitchWheel.slicePathCustom.minRadiusPercent = 0.2;
        this._pitchWheel.slicePathCustom.maxRadiusPercent = 0.5;
        this._pitchWheel.sliceSelectedPathCustom = this._pitchWheel.slicePathCustom;
        this._pitchWheel.sliceInitPathCustom = this._pitchWheel.slicePathCustom;

        this._pitchWheel.animatetime = 300;
        this._pitchWheel.createWheel(noteLabels);

        this._exitWheel.colors = ['#808080', '#c0c0c0'];
        this._exitWheel.slicePathFunction = slicePath().DonutSlice;
        this._exitWheel.slicePathCustom = slicePath().DonutSliceCustomization();
        this._exitWheel.slicePathCustom.minRadiusPercent = 0.0;
        this._exitWheel.slicePathCustom.maxRadiusPercent = 0.2;
        this._exitWheel.sliceSelectedPathCustom = this._exitWheel.slicePathCustom;
        this._exitWheel.sliceInitPathCustom = this._exitWheel.slicePathCustom;
        this._exitWheel.clickModeRotate = false;
        this._exitWheel.createWheel(['x', ' ']);

        this._accidentalsWheel.colors = ['#77c428', '#93e042', '#77c428', '#5ba900', '#77c428'];
        this._accidentalsWheel.slicePathFunction = slicePath().DonutSlice;
        this._accidentalsWheel.slicePathCustom = slicePath().DonutSliceCustomization();
        this._accidentalsWheel.slicePathCustom.minRadiusPercent = 0.50;
        this._accidentalsWheel.slicePathCustom.maxRadiusPercent = 0.75;
        this._accidentalsWheel.sliceSelectedPathCustom = this._accidentalsWheel.slicePathCustom;
        this._accidentalsWheel.sliceInitPathCustom = this._accidentalsWheel.slicePathCustom;

        var accidentalLabels = [];
        for (var i = 0; i < accidentals.length; i++) {
            accidentalLabels.push(accidentals[i]);
        }

        for (var i = 0; i < 9; i++) {
            accidentalLabels.push(null);
            this._accidentalsWheel.colors.push('#c0c0c0');
        }

        this._accidentalsWheel.animatetime = 300;
        this._accidentalsWheel.createWheel(accidentalLabels);
        this._accidentalsWheel.setTooltips([_('double sharp'), _('sharp'), _('natural'), _('flat'), _('double flat')]);

        if (hasOctaveWheel) {
            this._octavesWheel.colors = ['#ffb2bc', '#ffccd6', '#ffb2bc', '#ffccd6', '#ffb2bc', '#ffccd6', '#ffb2bc', '#ffccd6', '#c0c0c0', '#c0c0c0', '#c0c0c0', '#c0c0c0', '#c0c0c0', '#c0c0c0'];
            this._octavesWheel.slicePathFunction = slicePath().DonutSlice;
            this._octavesWheel.slicePathCustom = slicePath().DonutSliceCustomization();
            this._octavesWheel.slicePathCustom.minRadiusPercent = 0.75;
            this._octavesWheel.slicePathCustom.maxRadiusPercent = 0.95;
            this._octavesWheel.sliceSelectedPathCustom = this._octavesWheel.slicePathCustom;
            this._octavesWheel.sliceInitPathCustom = this._octavesWheel.slicePathCustom;
            var octaveLabels = ['1', '2', '3', '4', '5', '6', '7', '8', null, null, null, null, null, null];
            this._octavesWheel.animatetime = 300;
            this._octavesWheel.createWheel(octaveLabels);
        }

        // Position the widget over the note block.
        var x = this.container.x;
        var y = this.container.y;

        var canvasLeft = this.blocks.canvas.offsetLeft + 28 * this.blocks.blockScale;
        var canvasTop = this.blocks.canvas.offsetTop + 6 * this.blocks.blockScale;

        docById('wheelDiv').style.position = 'absolute';
        docById('wheelDiv').style.height = '300px';
        docById('wheelDiv').style.width = '300px';
        docById('wheelDiv').style.left = Math.min(this.blocks.turtles._canvas.width - 300, Math.max(0, Math.round((x + this.blocks.stage.x) * this.blocks.getStageScale() + canvasLeft) - 200)) + 'px';
        docById('wheelDiv').style.top = Math.min(this.blocks.turtles._canvas.height - 350, Math.max(0, Math.round((y + this.blocks.stage.y) * this.blocks.getStageScale() + canvasTop) - 200)) + 'px';
        
        // Navigate to a the current note value.
        var i = noteValues.indexOf(note);
        if (i === -1) {
            i = 4;
        }

        this._pitchWheel.navigateWheel(i);

        // Navigate to a the current accidental value.
        if (accidental === '') {
            this._accidentalsWheel.navigateWheel(2);
        } else {
            switch(accidental) {
            case DOUBLEFLAT:
                this._accidentalsWheel.navigateWheel(4);
                break;
            case FLAT:
                this._accidentalsWheel.navigateWheel(3);
                break;
            case NATURAL:
                this._accidentalsWheel.navigateWheel(2);
                break;
            case SHARP:
                this._accidentalsWheel.navigateWheel(1);
                break;
            case DOUBLESHARP:
                this._accidentalsWheel.navigateWheel(0);
                break;
            default:
                this._accidentalsWheel.navigateWheel(2);
                break;
            }
        }

        if (hasOctaveWheel) {
            // Use the octave associated with this block, if available.
            this._pitchOctave = this.blocks.findPitchOctave(this.connections[0]);

            // Navigate to current octave
            this._octavesWheel.navigateWheel(this._pitchOctave - 1);
        }

        // Set up event handlers
        var that = this;

        var __selectionChanged = function () {
            var label = that._pitchWheel.navItems[that._pitchWheel.selectedNavItemIndex].title;
            var i = noteLabels.indexOf(label);
            that.value = noteValues[i];
            var attr = that._accidentalsWheel.navItems[that._accidentalsWheel.selectedNavItemIndex].title;
            if (attr !== '♮') {
                label += attr;
                that.value += attr;
            }

            that.text.text = label;

            // Make sure text is on top.
            var z = that.container.children.length - 1;
            that.container.setChildIndex(that.text, z);
            that.updateCache();

            if (hasOctaveWheel) {
                // Set the octave of the pitch block if available
                var octave = Number(that._octavesWheel.navItems[that._octavesWheel.selectedNavItemIndex].title);
                that.blocks.setPitchOctave(that.connections[0], octave);
            }
        };

        var __pitchPreview = function () {
            var label = that._pitchWheel.navItems[that._pitchWheel.selectedNavItemIndex].title;
            var i = noteLabels.indexOf(label);
            var note = noteValues[i];
            var attr = that._accidentalsWheel.navItems[that._accidentalsWheel.selectedNavItemIndex].title;

            if (label === ' ') {
                return;
            } else if (attr !== '♮') {
                note += attr;
            }

            if (hasOctaveWheel) {
                var octave = Number(that._octavesWheel.navItems[that._octavesWheel.selectedNavItemIndex].title);
            } else {
                octave = 4;
            }

            // FIX ME: get key signature if available
            // FIX ME: get moveable if available
            var obj = getNote(note, octave, 0, 'C major', false, null, that.blocks.errorMsg);
            obj[0] = obj[0].replace(SHARP, '#').replace(FLAT, 'b');

            if (that.blocks.logo.instrumentNames[0] === undefined || that.blocks.logo.instrumentNames[0].indexOf('default') === -1) {
                if (that.blocks.logo.instrumentNames[0] === undefined) {
                    that.blocks.logo.instrumentNames[0] = [];
                }

                that.blocks.logo.instrumentNames[0].push('default');
                that.blocks.logo.synth.createDefaultSynth(0);
                that.blocks.logo.synth.loadSynth(0, 'default');
            }

            that.blocks.logo.synth.setMasterVolume(DEFAULTVOLUME);
            that.blocks.logo.setSynthVolume(0, 'default', DEFAULTVOLUME);
            console.log(obj[0] + obj[1]);
            that.blocks.logo.synth.trigger(0, [obj[0] + obj[1]], 1 / 8, 'default', null, null);

            __selectionChanged();
        };

        // Set up handlers for pitch preview.
        for (var i = 0; i < noteValues.length; i++) {
            this._pitchWheel.navItems[i].navigateFunction = __pitchPreview;
        }

        for (var i = 0; i < accidentals.length; i++) {
            this._accidentalsWheel.navItems[i].navigateFunction = __pitchPreview;
        }

        if (hasOctaveWheel) {
            for (var i = 0; i < 8; i++) {
                this._octavesWheel.navItems[i].navigateFunction = __pitchPreview;
            }
        }

        // Hide the widget when the exit button is clicked.
        this._exitWheel.navItems[0].navigateFunction = function () {
            docById('wheelDiv').style.display = 'none';
            that._pitchWheel.removeWheel();
            that._accidentalsWheel.removeWheel();
            that._exitWheel.removeWheel();
            if (hasOctaveWheel) {
                that._octavesWheel.removeWheel();
            }
        };
    };

    this._piemenuAccidentals = function (accidentalLabels, accidentalValues, accidental) {
        // wheelNav pie menu for accidental selection
        docById('wheelDiv').style.display = '';
        docById('wheelDiv').style.backgroundColor = '#c0c0c0';

        // the accidental selector
        this._accidentalWheel = new wheelnav('wheelDiv', null, 600, 600);
        // exit button
        this._exitWheel = new wheelnav('_exitWheel', this._accidentalWheel.raphael);

        var labels = [];
        for (var i = 0; i < accidentalLabels.length; i++) {
            var obj = accidentalLabels[i].split(' ');
            labels.push(last(obj));
        }

        labels.push(null);

        wheelnav.cssMode = true;

        this._accidentalWheel.keynavigateEnabled = true;

        this._accidentalWheel.colors = ['#77c428', '#93e042', '#77c428', '#5ba900', '#93e042'];
        this._accidentalWheel.slicePathFunction = slicePath().DonutSlice;
        this._accidentalWheel.slicePathCustom = slicePath().DonutSliceCustomization();
        this._accidentalWheel.slicePathCustom.minRadiusPercent = 0.2;
        this._accidentalWheel.slicePathCustom.maxRadiusPercent = 0.6;
        this._accidentalWheel.sliceSelectedPathCustom = this._accidentalWheel.slicePathCustom;
        this._accidentalWheel.sliceInitPathCustom = this._accidentalWheel.slicePathCustom;
        this._accidentalWheel.titleRotateAngle = 0;
        this._accidentalWheel.animatetime = 300;
        this._accidentalWheel.createWheel(labels);
        this._accidentalWheel.setTooltips(accidentalLabels)

        this._exitWheel.colors = ['#808080', '#c0c0c0'];
        this._exitWheel.slicePathFunction = slicePath().DonutSlice;
        this._exitWheel.slicePathCustom = slicePath().DonutSliceCustomization();
        this._exitWheel.slicePathCustom.minRadiusPercent = 0.0;
        this._exitWheel.slicePathCustom.maxRadiusPercent = 0.2;
        this._exitWheel.sliceSelectedPathCustom = this._exitWheel.slicePathCustom;
        this._exitWheel.sliceInitPathCustom = this._exitWheel.slicePathCustom;
        this._exitWheel.clickModeRotate = false;
        this._exitWheel.createWheel(['x', ' ']);

        var that = this;

        var __selectionChanged = function () {
            var label = that._accidentalWheel.navItems[that._accidentalWheel.selectedNavItemIndex].title;
            var i = labels.indexOf(label);
            that.value = accidentalValues[i];
            that.text.text = accidentalLabels[i];

            // Make sure text is on top.
            var z = that.container.children.length - 1;
            that.container.setChildIndex(that.text, z);
            that.updateCache();
        };

        var __exitMenu = function () {
            that._accidentalWheel.removeWheel();
            that._exitWheel.removeWheel();
            docById('wheelDiv').style.display = 'none';
        };

        // Position the widget over the note block.
        var x = this.container.x;
        var y = this.container.y;

        var canvasLeft = this.blocks.canvas.offsetLeft + 28 * this.blocks.blockScale;
        var canvasTop = this.blocks.canvas.offsetTop + 6 * this.blocks.blockScale;

        docById('wheelDiv').style.position = 'absolute';
        docById('wheelDiv').style.height = '300px';
        docById('wheelDiv').style.width = '300px';
        docById('wheelDiv').style.left = Math.min(this.blocks.turtles._canvas.width - 300, Math.max(0, Math.round((x + this.blocks.stage.x) * this.blocks.getStageScale() + canvasLeft) - 200)) + 'px';
        docById('wheelDiv').style.top = Math.min(this.blocks.turtles._canvas.height - 350, Math.max(0, Math.round((y + this.blocks.stage.y) * this.blocks.getStageScale() + canvasTop) - 200)) + 'px';
        
        // Navigate to a the current accidental value.
        var i = accidentalValues.indexOf(accidental);
        if (i === -1) {
            i = 2;
        }

        this._accidentalWheel.navigateWheel(i);

        // Hide the widget when the selection is made.
        for (var i = 0; i < accidentalLabels.length; i++) {
            this._accidentalWheel.navItems[i].navigateFunction = function () {
                __selectionChanged();
                __exitMenu();
            };
        }

        // Or use the exit wheel...
        this._exitWheel.navItems[0].navigateFunction = function () {
                __exitMenu();
        };
    };

    this._piemenuOctave = function (octave) {
        // wheelNav pie menu for octave selection
        docById('wheelDiv').style.display = '';
        docById('wheelDiv').style.backgroundColor = '#c0c0c0';

        // the octave selector
        this._octaveWheel = new wheelnav('wheelDiv', null, 600, 600);
        // exit button
        this._exitWheel = new wheelnav('_exitWheel', this._octaveWheel.raphael);


        // TODO: add prev, current, next options (but you'll need to
        // replace this number block with a text block)
        var octaveLabels = ['1', '2', '3', '4', '5', '6', '7', '8', null];

        wheelnav.cssMode = true;

        this._octaveWheel.keynavigateEnabled = true;

        this._octaveWheel.colors = ['#ffb2bc', '#ffccd6'];
        this._octaveWheel.slicePathFunction = slicePath().DonutSlice;
        this._octaveWheel.slicePathCustom = slicePath().DonutSliceCustomization();
        this._octaveWheel.slicePathCustom.minRadiusPercent = 0.2;
        this._octaveWheel.slicePathCustom.maxRadiusPercent = 0.6;
        this._octaveWheel.sliceSelectedPathCustom = this._octaveWheel.slicePathCustom;
        this._octaveWheel.sliceInitPathCustom = this._octaveWheel.slicePathCustom;
        this._octaveWheel.titleRotateAngle = 0;
        this._octaveWheel.animatetime = 300;
        this._octaveWheel.createWheel(octaveLabels);

        this._exitWheel.colors = ['#808080', '#c0c0c0'];
        this._exitWheel.slicePathFunction = slicePath().DonutSlice;
        this._exitWheel.slicePathCustom = slicePath().DonutSliceCustomization();
        this._exitWheel.slicePathCustom.minRadiusPercent = 0.0;
        this._exitWheel.slicePathCustom.maxRadiusPercent = 0.2;
        this._exitWheel.sliceSelectedPathCustom = this._exitWheel.slicePathCustom;
        this._exitWheel.sliceInitPathCustom = this._exitWheel.slicePathCustom;
        this._exitWheel.clickModeRotate = false;
        this._exitWheel.createWheel(['x', ' ']);

        var that = this;

        var __selectionChanged = function () {
            that.value = that._octaveWheel.selectedNavItemIndex + 1;
            that.text.text = octaveLabels[that.value -1];

            // Make sure text is on top.
            var z = that.container.children.length - 1;
            that.container.setChildIndex(that.text, z);
            that.updateCache();
        };

        var __exitMenu = function () {
            that._octaveWheel.removeWheel();
            that._exitWheel.removeWheel();
            docById('wheelDiv').style.display = 'none';
        };

        // Position the widget over the note block.
        var x = this.container.x;
        var y = this.container.y;

        var canvasLeft = this.blocks.canvas.offsetLeft + 28 * this.blocks.blockScale;
        var canvasTop = this.blocks.canvas.offsetTop + 6 * this.blocks.blockScale;

        docById('wheelDiv').style.position = 'absolute';
        docById('wheelDiv').style.height = '300px';
        docById('wheelDiv').style.width = '300px';
        docById('wheelDiv').style.left = Math.min(this.blocks.turtles._canvas.width - 300, Math.max(0, Math.round((x + this.blocks.stage.x) * this.blocks.getStageScale() + canvasLeft) - 200)) + 'px';
        docById('wheelDiv').style.top = Math.min(this.blocks.turtles._canvas.height - 350, Math.max(0, Math.round((y + this.blocks.stage.y) * this.blocks.getStageScale() + canvasTop) - 200)) + 'px';
        
        // Navigate to a the current octave value.
        var i = [1, 2, 3, 4, 5, 6, 7, 8].indexOf(octave);
        if (i === -1) {
            i = 3;
        }

        this._octaveWheel.navigateWheel(i);

        // Hide the widget when the selection is made.
        for (var i = 0; i < octaveLabels.length; i++) {
            this._octaveWheel.navItems[i].navigateFunction = function () {
                __selectionChanged();
                __exitMenu();
            };
        }

        // Or use the exit wheel...
        this._exitWheel.navItems[0].navigateFunction = function () {
                __exitMenu();
        };
    };

    this._piemenuBasic = function (menuLabels, menuValues, selectedValue, colors) {
        // basic wheelNav pie menu
        if (colors === undefined) {
            colors = ['#77c428', '#93e042', '#5ba900'];
        }

        docById('wheelDiv').style.display = '';
        docById('wheelDiv').style.backgroundColor = '#c0c0c0';

        // the selectedValueh selector
        this._basicWheel = new wheelnav('wheelDiv', null, 800, 800);

        var labels = [];
        for (var i = 0; i < menuLabels.length; i++) {
            labels.push(menuLabels[i]);
        }

        wheelnav.cssMode = true;

        this._basicWheel.keynavigateEnabled = true;

        this._basicWheel.colors = colors;
        this._basicWheel.slicePathFunction = slicePath().DonutSlice;
        this._basicWheel.slicePathCustom = slicePath().DonutSliceCustomization();
        this._basicWheel.slicePathCustom.minRadiusPercent = 0;
        this._basicWheel.slicePathCustom.maxRadiusPercent = 0.9;
        this._basicWheel.sliceSelectedPathCustom = this._basicWheel.slicePathCustom;
        this._basicWheel.sliceInitPathCustom = this._basicWheel.slicePathCustom;
        this._basicWheel.titleRotateAngle = 0;
        this._basicWheel.animatetime = 300;
        this._basicWheel.createWheel(labels);

        var that = this;

        var __selectionChanged = function () {
            var label = that._basicWheel.navItems[that._basicWheel.selectedNavItemIndex].title;
            var i = labels.indexOf(label);
            that.value = menuValues[i];
            that.text.text = menuLabels[i];

            // Make sure text is on top.
            var z = that.container.children.length - 1;
            that.container.setChildIndex(that.text, z);
            that.updateCache();
        };

        var __exitMenu = function () {
            that._basicWheel.removeWheel();
            docById('wheelDiv').style.display = 'none';
        };

        // Position the widget over the note block.
        var x = this.container.x;
        var y = this.container.y;

        var canvasLeft = this.blocks.canvas.offsetLeft + 28 * this.blocks.blockScale;
        var canvasTop = this.blocks.canvas.offsetTop + 6 * this.blocks.blockScale;

        docById('wheelDiv').style.position = 'absolute';
        docById('wheelDiv').style.height = '300px';
        docById('wheelDiv').style.width = '300px';
        docById('wheelDiv').style.left = Math.min(this.blocks.turtles._canvas.width - 300, Math.max(0, Math.round((x + this.blocks.stage.x) * this.blocks.getStageScale() + canvasLeft) - 200)) + 'px';
        docById('wheelDiv').style.top = Math.min(this.blocks.turtles._canvas.height - 350, Math.max(0, Math.round((y + this.blocks.stage.y) * this.blocks.getStageScale() + canvasTop) - 200)) + 'px';
        
        // Navigate to a the current selectedValue value.
        var i = menuValues.indexOf(selectedValue);
        if (i === -1) {
            i = 1;
        }

        this._basicWheel.navigateWheel(i);

        // Hide the widget when the selection is made.
        for (var i = 0; i < menuLabels.length; i++) {
            this._basicWheel.navItems[i].navigateFunction = function () {
                __selectionChanged();
                __exitMenu();
            };
        }
    };

    this._piemenuBoolean = function (booleanLabels, booleanValues, boolean) {
        // wheelNav pie menu for boolean selection
        docById('wheelDiv').style.display = '';
        docById('wheelDiv').style.backgroundColor = '#c0c0c0';

        // the booleanh selector
        this._booleanWheel = new wheelnav('wheelDiv', null, 600, 600);

        var labels = [];
        for (var i = 0; i < booleanLabels.length; i++) {
            labels.push(booleanLabels[i])
        }

        wheelnav.cssMode = true;

        this._booleanWheel.keynavigateEnabled = true;

        this._booleanWheel.colors = ['#d3cf76', '#b8b45f'];
        this._booleanWheel.slicePathFunction = slicePath().DonutSlice;
        this._booleanWheel.slicePathCustom = slicePath().DonutSliceCustomization();
        this._booleanWheel.slicePathCustom.minRadiusPercent = 0;
        this._booleanWheel.slicePathCustom.maxRadiusPercent = 0.6;
        this._booleanWheel.sliceSelectedPathCustom = this._booleanWheel.slicePathCustom;
        this._booleanWheel.sliceInitPathCustom = this._booleanWheel.slicePathCustom;
        this._booleanWheel.titleRotateAngle = 0;
        this._booleanWheel.animatetime = 300;
        this._booleanWheel.createWheel(labels);

        var that = this;

        var __selectionChanged = function () {
            var label = that._booleanWheel.navItems[that._booleanWheel.selectedNavItemIndex].title;
            var i = labels.indexOf(label);
            that.value = booleanValues[i];
            that.text.text = booleanLabels[i];

            // Make sure text is on top.
            var z = that.container.children.length - 1;
            that.container.setChildIndex(that.text, z);
            that.updateCache();
        };

        var __exitMenu = function () {
            that._booleanWheel.removeWheel();
            docById('wheelDiv').style.display = 'none';
        };

        // Position the widget over the note block.
        var x = this.container.x;
        var y = this.container.y;

        var canvasLeft = this.blocks.canvas.offsetLeft + 28 * this.blocks.blockScale;
        var canvasTop = this.blocks.canvas.offsetTop + 6 * this.blocks.blockScale;

        docById('wheelDiv').style.position = 'absolute';
        docById('wheelDiv').style.height = '300px';
        docById('wheelDiv').style.width = '300px';
        docById('wheelDiv').style.left = Math.min(this.blocks.turtles._canvas.width - 300, Math.max(0, Math.round((x + this.blocks.stage.x) * this.blocks.getStageScale() + canvasLeft) - 200)) + 'px';
        docById('wheelDiv').style.top = Math.min(this.blocks.turtles._canvas.height - 350, Math.max(0, Math.round((y + this.blocks.stage.y) * this.blocks.getStageScale() + canvasTop) - 200)) + 'px';
        
        // Navigate to a the current boolean value.
        var i = booleanValues.indexOf(boolean);
        if (i === -1) {
            i = 0;
        }

        this._booleanWheel.navigateWheel(i);

        // Hide the widget when the selection is made.
        this._booleanWheel.navItems[0].navigateFunction = function () {
            __selectionChanged();
            __exitMenu();
        };

        this._booleanWheel.navItems[1].navigateFunction = function () {
            __selectionChanged();
            __exitMenu();
        };
    };

    this._piemenuVoices = function (voiceLabels, voiceValues, categories, voice) {
        // wheelNav pie menu for voice selection
        const COLORS = ['#3ea4a3', '#60bfbc', '#1d8989', '#60bfbc', '#1d8989'];
        var colors = [];

        for (var i = 0; i < voiceLabels.length; i++) {
            colors.push(COLORS[categories[i] % COLORS.length]);
        }

        docById('wheelDiv').style.display = '';
        docById('wheelDiv').style.backgroundColor = '#c0c0c0';

        // the voice selector
        this._voiceWheel = new wheelnav('wheelDiv', null, 800, 800);
        // exit button
        this._exitWheel = new wheelnav('_exitWheel', this._voiceWheel.raphael);

        wheelnav.cssMode = true;

        this._voiceWheel.keynavigateEnabled = true;

        this._voiceWheel.colors = colors;
        this._voiceWheel.slicePathFunction = slicePath().DonutSlice;
        this._voiceWheel.slicePathCustom = slicePath().DonutSliceCustomization();
        this._voiceWheel.slicePathCustom.minRadiusPercent = 0.2;
        this._voiceWheel.slicePathCustom.maxRadiusPercent = 1;
        this._voiceWheel.sliceSelectedPathCustom = this._voiceWheel.slicePathCustom;
        this._voiceWheel.sliceInitPathCustom = this._voiceWheel.slicePathCustom;
        this._voiceWheel.titleRotateAngle = 0;
        this._voiceWheel.animatetime = 300;
        this._voiceWheel.createWheel(voiceLabels);

        this._exitWheel.colors = ['#808080', '#c0c0c0'];
        this._exitWheel.slicePathFunction = slicePath().DonutSlice;
        this._exitWheel.slicePathCustom = slicePath().DonutSliceCustomization();
        this._exitWheel.slicePathCustom.minRadiusPercent = 0.0;
        this._exitWheel.slicePathCustom.maxRadiusPercent = 0.2;
        this._exitWheel.sliceSelectedPathCustom = this._exitWheel.slicePathCustom;
        this._exitWheel.sliceInitPathCustom = this._exitWheel.slicePathCustom;
        this._exitWheel.clickModeRotate = false;
        this._exitWheel.createWheel(['x', ' ']);

        var that = this;

        var __selectionChanged = function () {
            var label = that._voiceWheel.navItems[that._voiceWheel.selectedNavItemIndex].title;
            var i = voiceLabels.indexOf(label);
            that.value = voiceValues[i];
            that.text.text = label;

            if (getDrumName(that.value) === null) {
                that.blocks.logo.synth.loadSynth(0, getVoiceSynthName(that.value));
            } else {
                that.blocks.logo.synth.loadSynth(0, getDrumSynthName(that.value));
            }

            // Make sure text is on top.
            var z = that.container.children.length - 1;
            that.container.setChildIndex(that.text, z);
            that.updateCache();
        };

        var __voicePreview = function () {
            var label = that._voiceWheel.navItems[that._voiceWheel.selectedNavItemIndex].title;
            var i = voiceLabels.indexOf(label);
            var voice = voiceValues[i];
            var timeout = 0;

            if (that.blocks.logo.instrumentNames[0] === undefined || that.blocks.logo.instrumentNames[0].indexOf(voice) === -1) {
                if (that.blocks.logo.instrumentNames[0] === undefined) {
                    that.blocks.logo.instrumentNames[0] = [];
                }

                that.blocks.logo.instrumentNames[0].push(voice);
                if (voice === 'default') {
                    that.blocks.logo.synth.createDefaultSynth(0);
                }

                that.blocks.logo.synth.loadSynth(0, voice);
                // give the synth time to load
                var timeout = 500;
            }

            setTimeout(function () {
                console.log(voice);
                that.blocks.logo.synth.setMasterVolume(DEFAULTVOLUME);
                that.blocks.logo.setSynthVolume(0, voice, DEFAULTVOLUME);
                that.blocks.logo.synth.trigger(0, 'G4', 1 / 4, voice, null, null, false);
                that.blocks.logo.synth.start();

            }, timeout);

            __selectionChanged();
        };

        // position widget
        var x = this.container.x;
        var y = this.container.y;

        var canvasLeft = this.blocks.canvas.offsetLeft + 28 * this.blocks.blockScale;
        var canvasTop = this.blocks.canvas.offsetTop + 6 * this.blocks.blockScale;

        docById('wheelDiv').style.position = 'absolute';
        docById('wheelDiv').style.height = '400px';
        docById('wheelDiv').style.width = '400px';
        docById('wheelDiv').style.left = Math.min(this.blocks.turtles._canvas.width - 400, Math.max(0, Math.round((x + this.blocks.stage.x) * this.blocks.getStageScale() + canvasLeft) - 200)) + 'px';
        docById('wheelDiv').style.top = Math.min(this.blocks.turtles._canvas.height - 450, Math.max(0, Math.round((y + this.blocks.stage.y) * this.blocks.getStageScale() + canvasTop) - 200)) + 'px';
        
        // navigate to a specific starting point
        var i = voiceValues.indexOf(voice);
        if (i === -1) {
            i = 0;
        }

        this._voiceWheel.navigateWheel(i);

        // Set up handlers for voice preview.
        for (var i = 0; i < voiceValues.length; i++) {
            this._voiceWheel.navItems[i].navigateFunction = __voicePreview;
        }

        // Hide the widget when the exit button is clicked.
        this._exitWheel.navItems[0].navigateFunction = function () {
            docById('wheelDiv').style.display = 'none';
        };
    };

    this._piemenuIntervals = function (selectedInterval) {
        // pie menu for interval selection
        docById('wheelDiv').style.display = '';
        docById('wheelDiv').style.backgroundColor = '#c0c0c0';

        // Use advanced constructor for more wheelnav on same div
        this._intervalNameWheel = new wheelnav('wheelDiv', null, 800, 800);
        this._intervalWheel = new wheelnav('this._intervalWheel', this._intervalNameWheel.raphael);
        // exit button
        this._exitWheel = new wheelnav('_exitWheel', this._intervalNameWheel.raphael);

        wheelnav.cssMode = true;

        this._intervalNameWheel.keynavigateEnabled = true;

        //Customize slicePaths for proper size
        this._intervalNameWheel.colors = ['#77c428', '#93e042', '#77c428', '#5ba900', '#93e042'];
        this._intervalNameWheel.slicePathFunction = slicePath().DonutSlice;
        this._intervalNameWheel.slicePathCustom = slicePath().DonutSliceCustomization();
        this._intervalNameWheel.slicePathCustom.minRadiusPercent = 0.2;
        this._intervalNameWheel.slicePathCustom.maxRadiusPercent = 0.8;
        this._intervalNameWheel.sliceSelectedPathCustom = this._intervalNameWheel.slicePathCustom;
        this._intervalNameWheel.sliceInitPathCustom = this._intervalNameWheel.slicePathCustom;
        this._intervalNameWheel.titleRotateAngle = 0;
        this._intervalNameWheel.clickModeRotate = false;
        // this._intervalNameWheel.clickModeRotate = false;
        var labels = [];
        for (var i = 0; i < INTERVALS.length; i++) {
            labels.push(_(INTERVALS[i][1]));
        }

        this._intervalNameWheel.animatetime = 300;
        this._intervalNameWheel.createWheel(labels);

        this._intervalWheel.colors = ['#77c428', '#93e042', '#77c428', '#5ba900', '#93e042'];
        this._intervalWheel.slicePathFunction = slicePath().DonutSlice;
        this._intervalWheel.slicePathCustom = slicePath().DonutSliceCustomization();
        this._intervalWheel.slicePathCustom.minRadiusPercent = 0.8;
        this._intervalWheel.slicePathCustom.maxRadiusPercent = 1;
        this._intervalWheel.sliceSelectedPathCustom = this._intervalWheel.slicePathCustom;
        this._intervalWheel.sliceInitPathCustom = this._intervalWheel.slicePathCustom;

        //Disable rotation, set navAngle and create the menus
        this._intervalWheel.clickModeRotate = false;
        // Align each set of numbers with its corresponding interval
        this._intervalWheel.navAngle = -(180 / labels.length) + (180 / (8 * labels.length));
        this._intervalWheel.animatetime = 300;

        var numbers = [];
        for (var i = 0; i < INTERVALS.length; i++) {
            for (var j = 1; j < 9; j++) {
                numbers.push(j.toString());
            }
        }

        this._intervalWheel.createWheel(numbers);

        this._exitWheel.colors = ['#808080', '#c0c0c0'];
        this._exitWheel.slicePathFunction = slicePath().DonutSlice;
        this._exitWheel.slicePathCustom = slicePath().DonutSliceCustomization();
        this._exitWheel.slicePathCustom.minRadiusPercent = 0.0;
        this._exitWheel.slicePathCustom.maxRadiusPercent = 0.2;
        this._exitWheel.sliceSelectedPathCustom = this._exitWheel.slicePathCustom;
        this._exitWheel.sliceInitPathCustom = this._exitWheel.slicePathCustom;
        this._exitWheel.clickModeRotate = false;
        this._exitWheel.createWheel(['x', ' ']);

        var that = this;

        // position widget
        var x = this.container.x;
        var y = this.container.y;

        var canvasLeft = this.blocks.canvas.offsetLeft + 28 * this.blocks.blockScale;
        var canvasTop = this.blocks.canvas.offsetTop + 6 * this.blocks.blockScale;

        docById('wheelDiv').style.position = 'absolute';
        docById('wheelDiv').style.height = '400px';
        docById('wheelDiv').style.width = '400px';
        docById('wheelDiv').style.left = Math.min(this.blocks.turtles._canvas.width - 400, Math.max(0, Math.round((x + this.blocks.stage.x) * this.blocks.getStageScale() + canvasLeft) - 200)) + 'px';
        docById('wheelDiv').style.top = Math.min(this.blocks.turtles._canvas.height - 450, Math.max(0, Math.round((y + this.blocks.stage.y) * this.blocks.getStageScale() + canvasTop) - 200)) + 'px';

        // Add function to each main menu for show/hide sub menus
        // FIXME: Add all tabs to each interval
        var __setupAction = function (i, activeTabs) {
            that._intervalNameWheel.navItems[i].navigateFunction = function () {
                for (var l = 0; l < labels.length; l++) {
                    for (var j = 0; j < 8; j++) {
                        if (l !== i) {
                            that._intervalWheel.navItems[l * 8 + j].navItem.hide();
                        } else if (activeTabs.indexOf(j + 1) === -1) {
                            that._intervalWheel.navItems[l * 8 + j].navItem.hide();
                        } else {
                            that._intervalWheel.navItems[l * 8 + j].navItem.show();
                        }
                    }
                }
            };
        };

        // Set up action for interval name so number tabs will
        // initialize on load.
        for (var i = 0; i < INTERVALS.length; i++) {
            __setupAction(i, INTERVALS[i][2]);
        }

        // navigate to a specific starting point
        var obj = selectedInterval.split(' ');
        for (var i = 0; i < INTERVALS.length; i++) {
            if (obj[0] === INTERVALS[i][1]) {
                break;
            }
        }

        if (i === INTERVALS.length) {
            i = 0;
        }

        this._intervalNameWheel.navigateWheel(i);

        var j = Number(obj[1]);
        if (INTERVALS[i][2].indexOf(j) !== -1) {
            this._intervalWheel.navigateWheel(j - 1);
        } else {
            this._intervalWheel.navigateWheel(INTERVALS[i][2][0] - 1);
        }

        var __exitMenu = function () {
            docById('wheelDiv').style.display = 'none';
        };

        var __selectionChanged = function () {
            var label = that._intervalNameWheel.navItems[that._intervalNameWheel.selectedNavItemIndex].title;
            var number = that._intervalWheel.navItems[that._intervalWheel.selectedNavItemIndex].title;

            that.value = INTERVALS[that._intervalNameWheel.selectedNavItemIndex][1] + ' ' + number;
            if (label === 'perfect 1') {
                that.text.text = _('unison');
            } else {
                that.text.text = label + ' ' + number;
            }

            // Make sure text is on top.
            var z = that.container.children.length - 1;
            that.container.setChildIndex(that.text, z);
            that.updateCache();

            var obj = getNote('C', 4, INTERVALVALUES[that.value][0], 'C major', false, null, null);
            obj[0] = obj[0].replace(SHARP, '#').replace(FLAT, 'b');

            if (that.blocks.logo.instrumentNames[0] === undefined || that.blocks.logo.instrumentNames[0].indexOf('default') === -1) {
                if (that.blocks.logo.instrumentNames[0] === undefined) {
                    that.blocks.logo.instrumentNames[0] = [];
                }

                that.blocks.logo.instrumentNames[0].push('default');
                that.blocks.logo.synth.createDefaultSynth(0);
                that.blocks.logo.synth.loadSynth(0, 'default');
            }

            that.blocks.logo.synth.setMasterVolume(DEFAULTVOLUME);
            that.blocks.logo.setSynthVolume(0, 'default', DEFAULTVOLUME);
            that.blocks.logo.synth.trigger(0, ['C4', obj[0] + obj[1]], 1 / 8, 'default', null, null);
        };

        // Set up handlers for preview.
        for (var i = 0; i < 8 * labels.length; i++) {
            this._intervalWheel.navItems[i].navigateFunction = __selectionChanged;
        }

        this._exitWheel.navItems[0].navigateFunction = __exitMenu;
    };

    this._piemenuModes = function (selectedMode) {
        // pie menu for mode selection

        // Look for a key block
        var key = 'C';

        var c = this.connections[0];
        if (c !== null) {
            if (this.blocks.blockList[c].name === 'setkey2') {
                var c1 = this.blocks.blockList[c].connections[1];
                if (c1 !== null) {
                    if (this.blocks.blockList[c1].name === 'notename') {
                        var key = this.blocks.blockList[c1].value;
                    }
                }
            }
        }

        console.log(key);

        docById('wheelDiv').style.display = '';
        docById('wheelDiv').style.backgroundColor = '#c0c0c0';

        //Use advanced constructor for more wheelnav on same div
        this._modeNameWheel = new wheelnav('wheelDiv', null, 1200, 1200);
        this._modeWheel = new wheelnav('this._modeWheel', this._modeNameWheel.raphael);
        // exit button
        this._exitWheel = new wheelnav('_exitWheel', this._modeNameWheel.raphael);

        wheelnav.cssMode = true;

        this._modeNameWheel.keynavigateEnabled = true;

        // Customize slicePaths
        var colors = [];
        for (var i = 0; i < MODENAMES.length; i++) {
            var mode = MODENAMES[i][1];
            if (mode in MUSICALMODES) {
                switch (MUSICALMODES[mode].length % 5) {
                case 0:
                    colors.push('#5ba900');
                    break;
                case 1:
                    colors.push('#77c428');
                    break;
                case 2:
                    colors.push('#93e042');
                    break;
                case 3:
                    colors.push('#3d8d00');
                    break;
                case 4:
                default:
                    colors.push('#adfd55');
                    break;
                }
            } else {
                colors.push('#93e042');
            }
        }

        this._modeNameWheel.colors = colors;
        this._modeNameWheel.slicePathFunction = slicePath().DonutSlice;
        this._modeNameWheel.slicePathCustom = slicePath().DonutSliceCustomization();
        this._modeNameWheel.slicePathCustom.minRadiusPercent = 0.2;
        this._modeNameWheel.slicePathCustom.maxRadiusPercent = 0.8;
        this._modeNameWheel.sliceSelectedPathCustom = this._modeNameWheel.slicePathCustom;
        this._modeNameWheel.sliceInitPathCustom = this._modeNameWheel.slicePathCustom;
        this._modeNameWheel.titleRotateAngle = 0;
        // this._modeNameWheel.clickModeRotate = false;
        var labels = [];
        for (var i = 0; i < MODENAMES.length; i++) {
            labels.push(_(MODENAMES[i][1]));
        }

        this._modeNameWheel.animatetime = 300;
        this._modeNameWheel.createWheel(labels);

        this._modeWheel.colors = ['#77c428', '#93e042'];
        this._modeWheel.slicePathFunction = slicePath().DonutSlice;
        this._modeWheel.slicePathCustom = slicePath().DonutSliceCustomization();
        this._modeWheel.slicePathCustom.minRadiusPercent = 0.8;
        this._modeWheel.slicePathCustom.maxRadiusPercent = 1;
        this._modeWheel.sliceSelectedPathCustom = this._modeWheel.slicePathCustom;
        this._modeWheel.sliceInitPathCustom = this._modeWheel.slicePathCustom;

        // Disable rotation, set navAngle and create the menus
        this._modeWheel.clickModeRotate = false;
        this._modeWheel.navAngle = -90;
        // this._modeWheel.selectedNavItemIndex = 2;
        this._modeWheel.animatetime = 300;
        this._modeWheel.createWheel(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);

        this._exitWheel.colors = ['#808080', '#c0c0c0'];
        this._exitWheel.slicePathFunction = slicePath().DonutSlice;
        this._exitWheel.slicePathCustom = slicePath().DonutSliceCustomization();
        this._exitWheel.slicePathCustom.minRadiusPercent = 0.0;
        this._exitWheel.slicePathCustom.maxRadiusPercent = 0.2;
        this._exitWheel.sliceSelectedPathCustom = this._exitWheel.slicePathCustom;
        this._exitWheel.sliceInitPathCustom = this._exitWheel.slicePathCustom;
        this._exitWheel.clickModeRotate = false;
        this._exitWheel.createWheel(['x', ' ']);

        var that = this;

        var __exitMenu = function () {
            docById('wheelDiv').style.display = 'none';
        };

        var __playNote = function () {
            var i = that._modeWheel.selectedNavItemIndex;
            // The mode doesn't matter here, since we are using semi-tones.
            var obj = getNote(key, 4, i, key + ' chromatic', false, null, null);
            obj[0] = obj[0].replace(SHARP, '#').replace(FLAT, 'b');
            console.log(obj[0]);

            if (that.blocks.logo.instrumentNames[0] === undefined || that.blocks.logo.instrumentNames[0].indexOf('default') === -1) {
                if (that.blocks.logo.instrumentNames[0] === undefined) {
                    that.blocks.logo.instrumentNames[0] = [];
                }

                that.blocks.logo.instrumentNames[0].push('default');
                that.blocks.logo.synth.createDefaultSynth(0);
                that.blocks.logo.synth.loadSynth(0, 'default');
            }

            that.blocks.logo.synth.setMasterVolume(DEFAULTVOLUME);
            that.blocks.logo.setSynthVolume(0, 'default', DEFAULTVOLUME);
            that.blocks.logo.synth.trigger(0, [obj[0] + obj[1]], 1 / 8, 'default', null, null);
        };

        var __selectionChanged = function () {
            that.value = MODENAMES[that._modeNameWheel.selectedNavItemIndex][1];
            that.text.text = that._modeNameWheel.navItems[that._modeNameWheel.selectedNavItemIndex].title;

            // Make sure text is on top.
            var z = that.container.children.length - 1;
            that.container.setChildIndex(that.text, z);
            that.updateCache();
        };

        // position widget
        var x = this.container.x;
        var y = this.container.y;

        var canvasLeft = this.blocks.canvas.offsetLeft + 28 * this.blocks.blockScale;
        var canvasTop = this.blocks.canvas.offsetTop + 6 * this.blocks.blockScale;

        docById('wheelDiv').style.position = 'absolute';
        docById('wheelDiv').style.height = '600px';
        docById('wheelDiv').style.width = '600px';

        // This widget is large. Be sure it fits on the screen.
        docById('wheelDiv').style.left = Math.min(this.blocks.turtles._canvas.width - 600, Math.max(0, Math.round((x + this.blocks.stage.x) * this.blocks.getStageScale() + canvasLeft) - 200)) + 'px';
        docById('wheelDiv').style.top = Math.min(this.blocks.turtles._canvas.height - 650, Math.max(0, Math.round((y + this.blocks.stage.y) * this.blocks.getStageScale() + canvasTop) - 200)) + 'px';

        // Add function to each main menu for show/hide sub menus
        var __setupAction = function (i, activeTabs) {
            that._modeNameWheel.navItems[i].navigateFunction = function () {
                for (var j = 0; j < 12; j++) {
                    if (activeTabs.indexOf(j) === -1) {
                        that._modeWheel.navItems[j].navItem.hide();
                    } else {
                        that._modeWheel.navItems[j].navItem.show();
                    }
                }

                __selectionChanged();
            };
        };

        for (var i = 0; i < 12; i++) {
            that._modeWheel.navItems[i].navigateFunction = __playNote;
        }

        for (var i = 0; i < MODENAMES.length; i++) {
            var mode = MODENAMES[i][1];
            if (mode in MUSICALMODES) {
                var activeTabs = [0];
                for (var j = 0; j < MUSICALMODES[mode].length; j++) {
                    activeTabs.push(last(activeTabs) + MUSICALMODES[mode][j]);
                }

                __setupAction(i, activeTabs);
            }
        }

        // navigate to a specific starting point
        for (var i = 0; i < MODENAMES.length; i++) {
            if (MODENAMES[i][1] === selectedMode) {
                break;
            }
        }

        if (i === MODENAMES.length) {
            i = 5;  // MAJOR
        }

        this._modeNameWheel.navigateWheel(i);

        this._exitWheel.navItems[0].navigateFunction = __exitMenu;
    };

    this._labelChanged = function () {
        // Update the block values as they change in the DOM label.
        if (this == null || this.label == null) {
            this._label_lock = false;
            return;
        }

        this._label_lock = true;

        this.label.style.display = 'none';
        if (this.labelattr != null) {
            this.labelattr.style.display = 'none';
        }

        var oldValue = this.value;

        if (this.label.value === '') {
            this.label.value = '_';
        }

        var newValue = this.label.value;

        if (this.labelattr != null) {
            var attrValue = this.labelattr.value;
            switch (attrValue) {
            case '𝄪':
            case '♯':
            case '𝄫':
            case '♭':
                newValue = newValue + attrValue;
                break;
            default:
                break;
            }
        }

        if (oldValue === newValue) {
            // Nothing to do in this case.
            this._label_lock = false;
            return;
        }

        var c = this.connections[0];
        if (this.name === 'text' && c != null) {
            var cblock = this.blocks.blockList[c];
            switch (cblock.name) {
            case 'action':
                var that = this;

                setTimeout(function () {
                    that.blocks.palettes.removeActionPrototype(oldValue);
                }, 1000);

                // Ensure new name is unique.
                var uniqueValue = this.blocks.findUniqueActionName(newValue);
                if (uniqueValue !== newValue) {
                    newValue = uniqueValue;
                    this.value = newValue;
                    var label = this.value.toString();
                    if (getTextWidth(label, 'bold 20pt Sans') > TEXTWIDTH) {  
                        label = label.substr(0, STRINGLEN) + '...';
                    }
                    this.text.text = label;
                    this.label.value = newValue;
                    this.updateCache();
                }
                break;
            default:
                break;
            }
        }

        // Update the block value and block text.
        if (this.name === 'number') {
            this.value = Number(newValue);
            if (isNaN(this.value)) {
                var thisBlock = this.blocks.blockList.indexOf(this);
                this.blocks.errorMsg(newValue + ': Not a number', thisBlock);
                this.blocks.refreshCanvas();
                this.value = oldValue;
            }
        } else {
            this.value = newValue;
        }

        if (this.name === 'solfege') {
            var obj = splitSolfege(this.value);
            var label = i18nSolfege(obj[0]);
            var attr = obj[1];

            if (attr !== '♮') {
                label += attr;
            }
        } else if (this.name === 'eastindiansolfege') {
            var obj = splitSolfege(this.value);
            var label = WESTERN2EISOLFEGENAMES[obj[0]];
            var attr = obj[1];

            if (attr !== '♮') {
                label += attr;
            }
        } else if (this.name === 'modename') {
            var label = this.value + ' ' + getModeNumbers(this.value);
        } else {
            var label = this.value.toString();
        }

        if (WIDENAMES.indexOf(this.name) === -1 && getTextWidth(label, 'bold 20pt Sans') > TEXTWIDTH ) {   
            var slen = label.length - 5;
            var nlabel = '' + label.substr(0, slen) + '...';
            while (getTextWidth(nlabel, 'bold 20pt Sans') > TEXTWIDTH) {
                slen -= 1;
                nlabel = '' + label.substr(0, slen) + '...';
                var foo = getTextWidth(nlabel, 'bold 20pt Sans');
                if (slen <= STRINGLEN) {
                    break;
                }
            }

            label = nlabel;
        }

        this.text.text = label;

        // and hide the DOM textview...
        this.label.style.display = 'none';

        // Make sure text is on top.
        var z = this.container.children.length - 1;
        this.container.setChildIndex(this.text, z);
        this.updateCache();

        var c = this.connections[0];
        if (this.name === 'text' && c != null) {
            var cblock = this.blocks.blockList[c];
            switch (cblock.name) {
            case 'action':
                // If the label was the name of an action, update the
                // associated run this.blocks and the palette buttons
                // Rename both do <- name and nameddo blocks.
                this.blocks.renameDos(oldValue, newValue);

                if (oldValue === _('action')) {
                    this.blocks.newNameddoBlock(newValue, this.blocks.actionHasReturn(c), this.blocks.actionHasArgs(c));
                    this.blocks.setActionProtoVisiblity(false);
                }

                this.blocks.newNameddoBlock(newValue, this.blocks.actionHasReturn(c), this.blocks.actionHasArgs(c));
                var blockPalette = this.blocks.palettes.dict['action'];
                for (var blk = 0; blk < blockPalette.protoList.length; blk++) {
                    var block = blockPalette.protoList[blk];
                    if (oldValue === _('action')) {
                        if (block.name === 'nameddo' && block.defaults.length === 0) {
                            block.hidden = true;
                        }
                    }
                    else {
                        if (block.name === 'nameddo' && block.defaults[0] === oldValue) {
                            blockPalette.remove(block, oldValue);
                        }
                    }
                }

                if (oldValue === _('action')) {
                    this.blocks.newNameddoBlock(newValue, this.blocks.actionHasReturn(c), this.blocks.actionHasArgs(c));
                    this.blocks.setActionProtoVisiblity(false);
                }
                this.blocks.renameNameddos(oldValue, newValue);
                this.blocks.palettes.hide();
                this.blocks.palettes.updatePalettes('action');
                this.blocks.palettes.show();
                break;
            case 'storein':
                // If the label was the name of a storein, update the
                // associated box this.blocks and the palette buttons.
                if (this.value !== 'box') {
                    this.blocks.newStoreinBlock(this.value);
                    this.blocks.newStorein2Block(this.value);
                    this.blocks.newNamedboxBlock(this.value);
                }

                // Rename both box <- name and namedbox blocks.
                this.blocks.renameBoxes(oldValue, newValue);
                this.blocks.renameNamedboxes(oldValue, newValue);
                this.blocks.renameStoreinBoxes(oldValue, newValue);
                this.blocks.renameStorein2Boxes(oldValue, newValue);

                this.blocks.palettes.hide();
                this.blocks.palettes.updatePalettes('boxes');
                this.blocks.palettes.show();
                break;
            case 'setdrum':
            case 'playdrum':
                if (_THIS_IS_MUSIC_BLOCKS_) {
                    if (newValue.slice(0, 4) === 'http') {
                        this.blocks.logo.synth.loadSynth(0, newValue);
                    }
                }
                break;
            default:
                break;
            }
        }

        // We are done changing the label, so unlock.
        this._label_lock = false;

        if (_THIS_IS_MUSIC_BLOCKS_) {
            // Load the synth for the selected drum.
            if (this.name === 'drumname') {
                this.blocks.logo.synth.loadSynth(0, getDrumSynthName(this.value));
            } else if (this.name === 'voicename') {
                this.blocks.logo.synth.loadSynth(0, getVoiceSynthName(this.value));
            }
        }
    };

};


function $() {
    var elements = new Array();

    for (var i = 0; i < arguments.length; i++) {
        var element = arguments[i];
        if (typeof element === 'string')
            element = docById(element);
        if (arguments.length === 1)
            return element;
        elements.push(element);
    }
    return elements;
};


window.hasMouse = false;
// Mousemove is not emulated for touch
document.addEventListener('mousemove', function (e) {
    window.hasMouse = true;
});


function _makeBitmap(data, name, callback, args) {
    // Async creation of bitmap from SVG data.
    // Works with Chrome, Safari, Firefox (untested on IE).
    var img = new Image();
    img.onload = function () {
        var bitmap = new createjs.Bitmap(img);
        callback(name, bitmap, args);
    };

    img.src = 'data:image/svg+xml;base64,' + window.btoa(unescape(encodeURIComponent(data)));
};
