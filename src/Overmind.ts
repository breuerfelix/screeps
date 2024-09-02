import { Zerg } from 'zerg/Zerg';
import { GameCache } from './caching/GameCache';
import { Colony } from './Colony';
import { log } from './console/log';
import { DirectiveClearRoom } from './directives/colony/clearRoom';
import { DirectivePoisonRoom } from './directives/colony/poisonRoom';
import { DirectiveWrapper } from './directives/initializer';
import { NotifierPriority } from './directives/Notifier';
import { RoomIntel } from './intel/RoomIntel';
import { TerminalNetworkV2 } from './logistics/TerminalNetwork_v2';
import { TraderJoe } from './logistics/TradeNetwork';
import { Mem } from './memory/Memory';
import { Overseer } from './Overseer';
import { profile } from './profiler/decorator';
import { Stats } from './stats/stats';
import { ExpansionPlanner } from './strategy/ExpansionPlanner';
import { alignedNewline } from './utilities/stringConstants';
import { Visualizer } from './visuals/Visualizer';
import { NEW_OVERMIND_INTERVAL, PROFILER_COLONY_LIMIT, PROFILER_INCLUDE_COLONIES, SUPPRESS_INVALID_DIRECTIVE_ALERTS, USE_SCREEPS_PROFILER, USE_TRY_CATCH } from './~settings';
import { Directive } from 'directives/Directive';
import { PowerZerg } from 'zerg/PowerZerg';
import { Overlord } from 'overlords/Overlord';
import { SpawnGroup } from 'logistics/SpawnGroup';

// TODO: maybe move into constructor
const profilerRooms: {[colonyName: string]: boolean} = {};
if (USE_SCREEPS_PROFILER) {
    for (const name of PROFILER_INCLUDE_COLONIES) {
        profilerRooms[name] = true;
    }

    const myRoomNames = _.filter(_.keys(Game.rooms), name => Game.rooms[name] && Game.rooms[name].my);
    for (const name of _.sample(myRoomNames, PROFILER_COLONY_LIMIT - PROFILER_INCLUDE_COLONIES.length)) {
        profilerRooms[name] = true;
    }
}

@profile
export default class _Overmind implements IOvermind {
	memory: Mem
	suspendedColonies: string[]
	suppressedColonies: string[]
	overseer: Overseer
	cache: GameCache
	shouldBuild: boolean;
	expiration: number;
	directives: { [flagName: string]: Directive };
	zerg: { [creepName: string]: Zerg };
	powerZerg: { [creepName: string]: PowerZerg };
	colonies: { [roomName: string]: Colony };
	overlords: { [ref: string]: Overlord };
	spawnGroups: { [ref: string]: SpawnGroup };
	colonyMap: { [roomName: string]: string };
	terminalNetwork: TerminalNetworkV2;
	tradeNetwork: TraderJoe;
	expansionPlanner: ExpansionPlanner;
	exceptions: Error[];
	roomIntel: RoomIntel;

    constructor() {
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
    }
	
    refresh() {
        this.shouldBuild = true;
        this.memory = Memory.Overmind;
        this.exceptions = [];
        this.cache.refresh();
        this.overseer.refresh();
        this.terminalNetwork.refresh();
        this.tradeNetwork.refresh();
        this.expansionPlanner.refresh();
		_.forEach(this.colonies, c => c.refresh())
		for (const directive in this.directives) {
			this.directives[directive].refresh();
		}

		this.registerDirectives(true);

        for (const o in this.overlords) {
            this.overlords[o].refresh();
        }
        for (const s in this.spawnGroups) {
            this.spawnGroups[s].refresh();
        }
        this.shouldBuild = false;
    }

	build() {
        log.debug('Rebuilding Overmind object!');
        this.cache.build();
        this.registerColonies();
        this.registerDirectives();
        _.forEach(this.colonies, c => c.spawnMoarOverlords());
        _.forEach(this.directives, d => d.spawnMoarOverlords());
        this.shouldBuild = false;
	}
	
    init() {
        this.try(() => RoomIntel.init());
        this.try(() => this.tradeNetwork.init());
        this.try(() => this.terminalNetwork.init());
        this.try(() => this.overseer.init(), 'overseer.init()');

        for (const colonyName in this.colonies) {
            const usedCPU = Game.cpu.getUsed();
            this.try(() => this.colonies[colonyName].init(), colonyName);
            Stats.log('cpu.usage.' + colonyName + '.init', Game.cpu.getUsed() - usedCPU);
        }

        for (const spawnGroupName in this.spawnGroups) {
            this.try(() => this.spawnGroups[spawnGroupName].init(), spawnGroupName);
        }

        this.try(() => this.expansionPlanner.init());
    }

	run() {
        for (const spawnGroupName in this.spawnGroups) {
            this.try(() => this.spawnGroups[spawnGroupName].run(), spawnGroupName);
        }

        this.try(() => this.overseer.run(), 'overseer.run()');

        for (const colonyName in this.colonies) {
            this.try(() => this.colonies[colonyName].run(), colonyName);
        }

        this.try(() => this.terminalNetwork.run());
        this.try(() => this.tradeNetwork.run());
        this.try(() => this.expansionPlanner.run());
        this.try(() => RoomIntel.run());
    }

    postRun() {
        this.handleExceptions();
	}
	
	visuals() {
        if (Game.cpu.bucket < 9000) {
			Game.time % 10 == 0 && log.info('CPU bucket is too low (' + Game.cpu.bucket + ') - skip rendering visuals.');
		}

		Visualizer.visuals();

		this.overseer.visuals();
		for (const c in this.colonies) {
			this.colonies[c].visuals();
		}
    }

	private try(callback: () => any, identifier?: string): void {
		if (!USE_TRY_CATCH) return callback()

		try {
			callback();
		} catch (e: any) {
			if (identifier) {
				e.name = `Caught unhandled exception at ${'' + callback} (identifier: ${identifier}): \n`
							+ e.name + '\n' + e.stack;
			} else {
				e.name = `Caught unhandled exception at ${'' + callback}: \n` + e.name + '\n' + e.stack;
			}
			this.exceptions.push(e);
		}
	}

    handleExceptions() {
        if (this.exceptions.length == 0) return;

		log.warning('Exceptions present this tick! Rebuilding Overmind object in next tick.');
		Memory.stats.persistent.lastErrorTick = Game.time;
		this.shouldBuild = true;
		this.expiration = Game.time;

		if (this.exceptions.length == 1) {
			throw _.first(this.exceptions);
		}
		
		for (const e of this.exceptions) {
			log.throw(e);
		}
		const err = new Error('Multiple exceptions caught this tick!');
		err.stack = _.map(this.exceptions, e => e.name).join('\n');
		throw err;
    }

    registerColonies() {
        this.colonyMap = {};

        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.my) continue
			
			const colony = Memory.colonies[roomName];
			if (colony && colony.suspend) {
				this.suspendedColonies.push(roomName);
				continue;
			}

			if (room.flags) {
				const suppressed = _.filter(room.flags, flag => DirectiveClearRoom.filter(flag) || DirectivePoisonRoom.filter(flag));
				if (suppressed.length > 0) {
					this.suppressedColonies.push(roomName);
					continue;
				}
			}

			this.colonyMap[roomName] = roomName;
        }
		
		const outpostFlagMap = _.groupBy(this.cache.outpostFlags, flag => flag.memory[MEM.COLONY]);
		const outpostMap = _.mapValues(outpostFlagMap, flag => _.map(flag, f => (f.memory.setPos || f.pos).roomName))
		for (const colonyName in outpostMap) {
			for (const outpostName of outpostMap[colonyName]) {
				this.colonyMap[outpostName] = colonyName
			}
		}
		
        let id = 0;
        for (const colonyName in this.colonyMap) {
			// if these do not match, it is an outpost
			if (this.colonyMap[colonyName] != colonyName) continue

            if (USE_SCREEPS_PROFILER && !profilerRooms[colonyName]) {
                Game.time % 20 == 0 && log.alert('Suppressing instantiation of colony ' + colonyName + '.');
                continue;
            }
			
			this.try(() => this.colonies[colonyName] = new Colony(id, colonyName, outpostMap[colonyName]))
            id++;
        }
    }

    registerDirectives(spawnOverlords: boolean = false) {
		for (const flag in Game.flags) {
            if (this.directives[flag]) {
                continue;
            }

            const room = Game.flags[flag].memory[MEM.COLONY];
            if (room) {
                if (USE_SCREEPS_PROFILER && !profilerRooms[room]) {
                    continue;
                }
                const colony = Memory.colonies[room];
                if (colony && colony.suspend) {
                    continue;
                }
            }

            const directive = DirectiveWrapper(Game.flags[flag])
			const found = !!this.directives[flag];

            if (directive && found && spawnOverlords) {
				directive.spawnMoarOverlords();
			}

            if (!directive && !SUPPRESS_INVALID_DIRECTIVE_ALERTS && Game.time % 10 == 0) {
				log.alert('Flag [' + flag + ' @ ' + Game.flags[flag].pos.print + '] does not match ' + 'a valid directive color code! (Refer to /src/directives/initializer.ts)' + alignedNewline + 'Use removeErrantFlags() to remove flags which do not match a directive.');
            }
        }
    }

    handleNotifications() {
        for (const colony of this.suspendedColonies) {
            this.overseer.notifier.alert('Colony suspended', colony, NotifierPriority.High);
        }

        for (const colony of this.suppressedColonies) {
            this.overseer.notifier.alert('Colony suppressed', colony, NotifierPriority.Low);
        }
    }
}