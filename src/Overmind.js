const a0_0x9c0c48 = (function () {
        let _0x2ddfd9 = true;
        return function (_0x1d7b39, _0x5a5a36) {
            const _0x5a0ff2 = _0x2ddfd9 ? function () {
                ;
                if (_0x5a5a36) {
                    const _0x2c9ad1 = _0x5a5a36.apply(_0x1d7b39, arguments);
                    return _0x5a5a36 = null, _0x2c9ad1;
                }
            } : function () {
            };
            return _0x2ddfd9 = false, _0x5a0ff2;
        };
    }()), a0_0x5db943 = a0_0x9c0c48(undefined, function () {
        ;
        return a0_0x5db943.toString().search('(((.+)+)+)+$').toString().constructor(a0_0x5db943).search('(((.+)+)+)+$');
    });
a0_0x5db943();
;
var __decorate = undefined && undefined.__decorate || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function') {
        r = Reflect.decorate(decorators, target, key, desc);
    } else {
        for (var i = decorators.length - 1; i >= 0; i--) {
            if (d = decorators[i]) {
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
            }
        }
    }
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const profilerRooms = {};
;
if (USE_SCREEPS_PROFILER) {
    for (const name of PROFILER_INCLUDE_COLONIES) {
        profilerRooms[name] = true;
    }
    const myRoomNames = _.filter(_.keys(Game.rooms), _0x1259c6 => Game.rooms[_0x1259c6] && Game.rooms[_0x1259c6].my);
    for (const name of _.sample(myRoomNames, PROFILER_COLONY_LIMIT - PROFILER_INCLUDE_COLONIES.length)) {
        profilerRooms[name] = true;
    }
}
let _Overmind = class _Overmind {
    constructor() {
        ;
        this.memory = Memory.Overmind;
        this.overseer = new Overseer();
        this.shouldBuild = true;
        this.expiration = Game.time + NEW_OVERMIND_INTERVAL;
        this.cache = new GameCache();
        this.colonies = {};
        this.suspendedColonies = [];
        this.suppressedColonies = [];
        this.directives = {};
        this.zerg = {};
        this.powerZerg = {};
        this.overlords = {};
        this.spawnGroups = {};
        this.colonyMap = {};
        this.terminalNetwork = new TerminalNetworkV2();
        global.TerminalNetwork = this.terminalNetwork;
        this.tradeNetwork = new TraderJoe();
        global.TradeNetwork = this.tradeNetwork;
        this.expansionPlanner = new ExpansionPlanner();
        this.roomIntel = new RoomIntel();
        this.exceptions = [];
        ;
    }
    ['build']() {
        ;
        log.debug('Rebuilding Overmind object!');
        this.cache.build();
        this.registerColonies();
        this.registerDirectives();
        _.forEach(this.colonies, _0x2f32eb => _0x2f32eb.spawnMoarOverlords());
        _.forEach(this.directives, _0x2ad10f => _0x2ad10f.spawnMoarOverlords());
        this.shouldBuild = false;
        ;
    }
    ['refresh']() {
        ;
        this.shouldBuild = true;
        this.memory = Memory.Overmind;
        this.exceptions = [];
        this.cache.refresh();
        this.overseer.refresh();
        this.terminalNetwork.refresh();
        this.tradeNetwork.refresh();
        this.expansionPlanner.refresh();
        this.refreshColonies();
        this.refreshDirectives();
        ;
        for (const _0x549018 in this.overlords) {
            this.overlords[_0x549018].refresh();
        }
        for (const _0x206f79 in this.spawnGroups) {
            this.spawnGroups[_0x206f79].refresh();
        }
        this.shouldBuild = false;
    }
    ['try'](_0x3766f0, _0x2bbc27) {
        ;
        if (USE_TRY_CATCH) {
            try {
                _0x3766f0();
            } catch (_0x364cc9) {
                _0x2bbc27 ? _0x364cc9.name = 'Caught unhandled exception at ' + ('' + _0x3766f0) + ' (identifier: ' + _0x2bbc27 + '): \n' + _0x364cc9.name + '\n' + _0x364cc9.stack : _0x364cc9.name = 'Caught unhandled exception at ' + ('' + _0x3766f0) + ': \n' + _0x364cc9.name + '\n' + _0x364cc9.stack;
                this.exceptions.push(_0x364cc9);
                ;
            }
        } else {
            _0x3766f0();
        }
    }
    ['handleExceptions']() {
        ;
        if (this.exceptions.length == 0) {
            return;
        } else {
            log.warning('Exceptions present this tick! Rebuilding Overmind object in next tick.');
            Memory.stats.persistent.lastErrorTick = Game.time;
            this.shouldBuild = true;
            this.expiration = Game.time;
            ;
            if (this.exceptions.length == 1) {
                throw _.first(this.exceptions);
            } else {
                for (const _0x3d4ff1 of this.exceptions) {
                    log.throw(_0x3d4ff1);
                }
                const _0x691be9 = new Error('Multiple exceptions caught this tick!');
                _0x691be9.stack = _.map(this.exceptions, _0x1e859b => _0x1e859b.name).join('\n');
                throw _0x691be9;
            }
        }
    }
    ['registerColonies']() {
        const _0x12998f = { _0x497326: _.map(_0x230549[_0x497326], _0x6fa37a => (_0x6fa37a.memory.setPos || _0x6fa37a.pos).roomName) };
        this.colonyMap = {};
        const _0x230549 = _.groupBy(this.cache.outpostFlags, _0x22b02a => _0x22b02a.memory.C);
        for (const _0x497326 in Game.rooms) {
            const _0x5c60f2 = Game.rooms[_0x497326];
            if (_0x5c60f2.my) {
                const _0x36fbca = Memory.colonies[_0x497326];
                if (_0x36fbca && _0x36fbca.suspend) {
                    this.suspendedColonies.push(_0x497326);
                    continue;
                }
                if (_0x5c60f2.flags) {
                    const _0x5c135e = _.filter(_0x5c60f2.flags, _0x5e242b => DirectiveClearRoom.filter(_0x5e242b) || DirectivePoisonRoom.filter(_0x5e242b));
                    if (_0x5c135e.length > 0) {
                        this.suppressedColonies.push(_0x497326);
                        continue;
                    }
                    ;
                }
                this.colonyMap[_0x497326] = _0x497326;
            }
        }
        for (const _0x2b6639 in _0x12998f) {
            for (const _0x2b9b96 of _0x12998f[_0x2b6639]) {
                this.colonyMap[_0x2b9b96] = _0x2b6639;
            }
        }
        let _0x57d5ea = 0;
        for (const _0x246b4c in _0x12998f) {
            if (USE_SCREEPS_PROFILER && !profilerRooms[_0x246b4c]) {
                Game.time % 20 == 0 && log.alert('Suppressing instantiation of colony ' + _0x246b4c + '.');
                continue;
            }
            try {
                this.colonies[_0x246b4c] = new Colony(_0x57d5ea, _0x246b4c, _0x12998f[_0x246b4c]);
            } catch (_0x574237) {
                _0x574237.name = 'Caught unhandled exception instantiating colony ' + _0x246b4c + ': \n' + _0x574237.name;
                this.exceptions.push(_0x574237);
                ;
            }
            _0x57d5ea++;
        }
    }
    ['refreshColonies']() {
        ;
        for (const _0x28bede in this.colonies) {
            try {
                this.colonies[_0x28bede].refresh();
            } catch (_0x598b01) {
                _0x598b01.name = 'Caught unhandled exception refreshing colony ' + _0x28bede + ': \n' + _0x598b01.name;
                this.exceptions.push(_0x598b01);
                ;
            }
        }
    }
    ['registerDirectives'](_0x4d96c5 = false) {
        ;
        for (const _0x135eb4 in Game.flags) {
            if (this.directives[_0x135eb4]) {
                continue;
            }
            const _0x17c80d = Game.flags[_0x135eb4].memory.C;
            if (_0x17c80d) {
                if (USE_SCREEPS_PROFILER && !profilerRooms[_0x17c80d]) {
                    continue;
                }
                const _0x1b1766 = Memory.colonies[_0x17c80d];
                if (_0x1b1766 && _0x1b1766.suspend) {
                    continue;
                }
            }
            const _0x13495c = DirectiveWrapper(Game.flags[_0x135eb4]), _0x2b31d9 = !!this.directives[_0x135eb4];
            _0x13495c && _0x2b31d9 && _0x4d96c5 && _0x13495c.spawnMoarOverlords();
            !_0x13495c && !SUPPRESS_INVALID_DIRECTIVE_ALERTS && Game.time % 10 == 0 && log.alert('Flag [' + _0x135eb4 + ' @ ' + Game.flags[_0x135eb4].pos.print + '] does not match ' + 'a valid directive color code! (Refer to /src/directives/initializer.ts)' + alignedNewline + 'Use removeErrantFlags() to remove flags which do not match a directive.');
            ;
        }
    }
    ['refreshDirectives']() {
        ;
        for (const _0x5f5127 in this.directives) {
            this.directives[_0x5f5127].refresh();
        }
        this.registerDirectives(true);
    }
    ['init']() {
        ;
        this.try(() => RoomIntel.init());
        this.try(() => this.tradeNetwork.init());
        this.try(() => this.terminalNetwork.init());
        this.try(() => this.overseer.init(), 'overseer.init()');
        ;
        for (const _0x2c3db8 in this.colonies) {
            const _0x31d800 = Game.cpu.getUsed();
            this.try(() => this.colonies[_0x2c3db8].init(), _0x2c3db8);
            Stats.log('cpu.usage.' + _0x2c3db8 + '.init', Game.cpu.getUsed() - _0x31d800);
            ;
        }
        for (const _0x315665 in this.spawnGroups) {
            this.try(() => this.spawnGroups[_0x315665].init(), _0x315665);
        }
        this.try(() => this.expansionPlanner.init());
    }
    ['run']() {
        ;
        for (const _0x21daa9 in this.spawnGroups) {
            this.try(() => this.spawnGroups[_0x21daa9].run(), _0x21daa9);
        }
        this.try(() => this.overseer.run(), 'overseer.run()');
        for (const _0x2e136d in this.colonies) {
            this.try(() => this.colonies[_0x2e136d].run(), _0x2e136d);
        }
        this.try(() => this.terminalNetwork.run());
        this.try(() => this.tradeNetwork.run());
        this.try(() => this.expansionPlanner.run());
        this.try(() => RoomIntel.run());
        ;
    }
    ['postRun']() {
        ;
        this.try(() => Segmenter.run());
        this.handleExceptions();
        ;
    }
    ['handleNotifications']() {
        ;
        for (const _0x2599cf of this.suspendedColonies) {
            this.overseer.notifier.alert('Colony suspended', _0x2599cf, NotifierPriority.High);
        }
        for (const _0x83137a of this.suppressedColonies) {
            this.overseer.notifier.alert('Colony suppressed', _0x83137a, NotifierPriority.Low);
        }
    }
    ['visuals']() {
        ;
        if (Game.cpu.bucket > 9000) {
            Visualizer.visuals();
            if (VersionUpdater.memory.newestVersion) {
                const _0x440b61 = VersionUpdater.memory.newestVersion;
                VersionUpdater.isVersionOutdated(_0x440b61) && this.overseer.notifier.alert('[!] Update available: ' + __VERSION__ + ' \u2192 ' + _0x440b61, undefined, -1);
            }
            this.overseer.visuals();
            for (const _0x17ea3a in this.colonies) {
                this.colonies[_0x17ea3a].visuals();
            }
        } else {
            Game.time % 10 == 0 && log.info('CPU bucket is too low (' + Game.cpu.bucket + ') - skip rendering visuals.');
        }
    }
};
_Overmind = __decorate([profile], _Overmind);
var _Overmind$1 = _Overmind;