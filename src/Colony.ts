import {log} from './console/log';
import {Roles} from './creepSetups/setups';
// import {DirectivePraise} from './directives/colony/praise';
import {DirectiveExtract} from './directives/resource/extract';
import {DirectiveHarvest, HARVEST_MEM} from './directives/resource/harvest';
import {HiveCluster} from './hiveClusters/_HiveCluster';
import {CommandCenter} from './hiveClusters/commandCenter';
import {EvolutionChamber} from './hiveClusters/evolutionChamber';
import {Hatchery} from './hiveClusters/hatchery';
// import {PraiseSite} from './hiveClusters/praiseSite';
import {SporeCrawler} from './hiveClusters/sporeCrawler';
import {UpgradeSite} from './hiveClusters/upgradeSite';
import {CombatIntel} from './intel/CombatIntel';
import {Energetics} from './logistics/Energetics';
import {LinkNetwork} from './logistics/LinkNetwork';
import {LogisticsNetwork} from './logistics/LogisticsNetwork';
import {RoadLogistics} from './logistics/RoadLogistics';
import {SpawnGroup} from './logistics/SpawnGroup';
import {TransportRequestGroup} from './logistics/TransportRequestGroup';
import {Mem} from './memory/Memory';
import {DefaultOverlord} from './overlords/core/default';
import {TransportOverlord} from './overlords/core/transporter';
import {WorkerOverlord} from './overlords/core/worker';
import {RandomWalkerScoutOverlord} from './overlords/scouting/randomWalker';
import {profile} from './profiler/decorator';
import {ALL_ZERO_ASSETS} from './resources/map_resources';
import {bunkerLayout, getPosFromBunkerCoord} from './roomPlanner/layouts/bunker';
import {RoomPlanner} from './roomPlanner/RoomPlanner';
import {LOG_STATS_INTERVAL, Stats} from './stats/stats';
import {ColonyExpansionData, EXPANSION_EVALUATION_FREQ, ExpansionEvaluator} from './strategy/ExpansionEvaluator';
import {Cartographer, ROOMTYPE_CONTROLLER} from './utilities/Cartographer';
import {maxBy, mergeSum, minBy} from './utilities/utils';
import {Visualizer} from './visuals/Visualizer';
import {Zerg} from './zerg/Zerg';

export enum ColonyStage {
	Larva = 0,		// No storage and no incubator
	Pupa  = 1,		// Has storage but RCL < 8
	Adult = 2,		// RCL 8 room
}

export enum DEFCON {
	safe               = 0,
	invasionNPC        = 1,
	boostedInvasionNPC = 2,
	playerInvasion     = 2,
	bigPlayerInvasion  = 3,
}

export function getAllColonies(): Colony[] {
	return _.values(Overmind.colonies);
}

export interface BunkerData {
	anchor: RoomPosition;
	topSpawn: StructureSpawn | undefined;
	coreSpawn: StructureSpawn | undefined;
	rightSpawn: StructureSpawn | undefined;
}

export interface ColonyMemory {
	defcon: {
		level: number,
		tick: number,
	};
	expansionData: ColonyExpansionData;
	maxLevel: number;
	outposts: { [roomName: string]: OutpostData };
	suspend?: boolean;
	debug?: boolean;
}

// Outpost that is currently not being maintained
export interface OutpostData {
	active: boolean;
	suspendReason?: OutpostDisableReason;
	[MEM.EXPIRATION]?: number; // Tick to recalculate
}

export enum OutpostDisableReason {
	active             = 'active',
	inactiveCPU        = 'i_cpu', // CPU limitations
	inactiveUpkeep     = 'i_upkeep', // room can't sustain this remote because rebooting, spawn pressure, etc
	inactiveHarassment = 'i_harassment',
	inactiveStronghold = 'i_stronghold',
}

const getDefaultColonyMemory: () => ColonyMemory = () => ({
	defcon       : {
		level: DEFCON.safe,
		tick : -Infinity
	},
	expansionData: {
		possibleExpansions: {},
		expiration        : 0,
	},
	maxLevel     : 0,
	outposts     : {},
});

export interface Assets {
	energy: number;
	power: number;
	ops: number;

	[resourceType: string]: number;
}

/**
 * Colonies are the highest-level object other than the global Overmind. A colony groups together all rooms, structures,
 * creeps, utilities, etc. which are run from a single owned room.
 */
@profile
export class Colony {
	// Colony memory
	memory: ColonyMemory;								// Memory.colonies[name]
	// Room associations
	name: string;										// Name of the primary colony room
	ref: string;
	id: number; 										// Order in which colony is instantiated from Overmind
	roomNames: string[];								// The names of all rooms including the primary room
	outposts: Room[];									// Rooms for remote resource collection
	// abandonedOutposts: AbandonedOutpost[];				// Outposts that are not currently maintained, not used for now
	rooms: Room[];										// All rooms including the primary room
	pos: RoomPosition;
	assets: Assets;
	// Physical colony structures and roomObjects
	spawns: StructureSpawn[];							// |
	availableLinks: StructureLink[];					// | links available to claim
	labs: StructureLab[];								// |
	tombstones: Tombstone[]; 							// | Tombstones in all colony rooms
	drops: { [resourceType: string]: Resource[] }; 		// | Dropped resources in all colony rooms
	sources: Source[];									// | Sources in all colony rooms
	extractors: StructureExtractor[];					// | All extractors in owned and remote rooms
	flags: Flag[];										// | Flags assigned to the colony
	constructionSites: ConstructionSite[];				// | Construction sites in all colony rooms
	repairables: Structure[];							// | Repairable structures, discounting barriers and roads
	rechargeables: rechargeObjectType[];				// | Things that can be recharged from
	// obstacles: RoomPosition[]; 							// | List of other obstacles, e.g. immobile creeps
	destinations: { pos: RoomPosition, order: number }[];
	// Hive clusters
	hiveClusters: HiveCluster[];						// List of all hive clusters
	commandCenter: CommandCenter | undefined;			// Component with logic for non-spawning structures
	hatchery: Hatchery | undefined;						// Component to encapsulate spawner logic
	spawnGroup: SpawnGroup | undefined;
	evolutionChamber: EvolutionChamber | undefined; 	// Component for mineral processing
	upgradeSite: UpgradeSite;							// Component to provide upgraders with uninterrupted energy
	sporeCrawler: SporeCrawler;
	// miningSites: { [sourceID: string]: MiningSite };	// Component with logic for mining and hauling
	// extractionSites: { [extractorID: string]: ExtractionSite };
	miningSites: { [flagName: string]: DirectiveHarvest };	// Component with logic for mining and hauling
	extractionSites: { [flagName: string]: DirectiveExtract };
	// praiseSite: PraiseSite | undefined;
	// Operational state
	level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; 				// Level of the colony's main room
	stage: number;										// The stage of the colony "lifecycle"
	defcon: number;										//
	state: {
		bootstrapping?: boolean; 						// Whether colony is bootstrapping or recovering from crash
		isIncubating?: boolean;							// If the colony is incubating
		lowPowerMode?: boolean; 						// Activate if RCL8 and full energy
		isRebuilding?: boolean;							// If colony is doing major reconstruction (e.g. moving in room)
		isEvacuating?: boolean;							// If we're clearing the terminal if colony is about to fail
		isBeingNuked?: boolean;
	};
	// terminalState: TerminalState | undefined;
	layout: 'twoPart' | 'bunker';						// Which room design colony uses
	bunker: BunkerData | undefined;						// The center tile of the bunker, else undefined
	// Creeps and subsets
	creeps: Creep[];										// Creeps bound to the colony
	creepsByRole: { [roleName: string]: Creep[] };		// Creeps hashed by their role name
	// Resource requests
	linkNetwork: LinkNetwork;
	logisticsNetwork: LogisticsNetwork;
	transportRequests: TransportRequestGroup;
	// Overlords
	overlords: {
		default: DefaultOverlord;
		work: WorkerOverlord;
		logistics: TransportOverlord;
		scout?: RandomWalkerScoutOverlord;
	};
	// Road network
	roadLogistics: RoadLogistics;
	// Room planner
	roomPlanner: RoomPlanner;
	// abathur: Abathur;

	static settings = {
		remoteSourcesByLevel: {
			1: 1,
			2: 2,
			3: 3,
			4: 4,
			5: 5,
			6: 6,
			7: 7,
			8: 9,
		},
		maxSourceDistance   : 100
	};

	constructor(id: number, roomName: string, outposts: string[]) {
		// Primitive colony setup
		this.id = id;
		this.name = roomName;
		this.ref = roomName;
		this.roomNames = [roomName].concat(outposts);
		this.memory = Mem.wrap(Memory.colonies, roomName, getDefaultColonyMemory);
		// Format outpost state memory
		_.forEach(outposts, outpost => {
			if (!this.memory.outposts[outpost]) {
				this.memory.outposts[outpost] = {active: true};
			}
		});
		_.forEach(_.keys(_.clone(this.memory.outposts)), roomName => {
			if (!outposts.includes(roomName)) {
				delete this.memory.outposts[roomName];
			}
		});
		// Register colony globally to allow 'W1N1' and 'w1n1' to refer to Overmind.colonies.W1N1
		global[this.name] = this;
		global[this.name.toLowerCase()] = this;
		
		// TODO: do these have to get cleared each refresh?
		// but outposts will only get refreshed each BUILD phase
		this.miningSites = {}; 				// filled in by harvest directives
		this.extractionSites = {};			// filled in by extract directives
		this.flags = []; 					// filled in by directives
		this.destinations = []; 			// filled in by various hive clusters and directives

		// this.creeps is not assigned
		// this.outposts is not assigned

		this.linkNetwork = new LinkNetwork(this);
		this.logisticsNetwork = new LogisticsNetwork(this);
		this.transportRequests = new TransportRequestGroup();
		this.roomPlanner = new RoomPlanner(this);
		this.roadLogistics = new RoadLogistics(this);

		this.registerHiveClusters();
	}

	/**
	 * Refreshes the state of the colony object
	 */
	refresh(): void {
		this.memory = Memory.colonies[this.room.name];
		
		if (this.terminal) {
			Overmind.terminalNetwork.addColony(this);
		}

		// Refresh rooms
		const outpostRoomNames = _.filter(this.roomNames, roomName => this.room.name != roomName);
		this.outposts = _.compact(_.map(outpostRoomNames, outpost => Game.rooms[outpost]));
		this.rooms = [this.room].concat(this.outposts);

		// refresh creeps
		this.creeps = Overmind.cache.creepsByColony[this.name] || [];
		this.creepsByRole = _.groupBy(this.creeps, creep => creep.memory.role);
		
		this.spawns = this.getSpawns()
		this.labs = this.getLabs()
		this.availableLinks = _.clone(this.room.links);

		// this could be in refresh for now
		// TODO lets see where to put this best
		if (this.roomPlanner.memory.bunkerData && this.roomPlanner.memory.bunkerData.anchor) {
			this.layout = 'bunker';
			const anchor = derefRoomPosition(this.roomPlanner.memory.bunkerData.anchor);
			// log.debug(JSON.stringify(`anchor for ${this.name}: ${anchor}`));
			const spawnPositions = _.map(bunkerLayout[8]!.buildings.spawn.pos, c => getPosFromBunkerCoord(c, this));
			// log.debug(JSON.stringify(`spawnPositions for ${this.name}: ${spawnPositions}`));
			const rightSpawnPos = maxBy(spawnPositions, pos => pos.x) as RoomPosition;
			const topSpawnPos = minBy(spawnPositions, pos => pos.y) as RoomPosition;
			const coreSpawnPos = anchor.findClosestByRange(spawnPositions) as RoomPosition;
			// log.debug(JSON.stringify(`spawnPoses: ${rightSpawnPos}, ${topSpawnPos}, ${coreSpawnPos}`));
			this.bunker = {
				anchor    : anchor,
				topSpawn  : topSpawnPos.lookForStructure(STRUCTURE_SPAWN) as StructureSpawn | undefined,
				coreSpawn : coreSpawnPos.lookForStructure(STRUCTURE_SPAWN) as StructureSpawn | undefined,
				rightSpawn: rightSpawnPos.lookForStructure(STRUCTURE_SPAWN) as StructureSpawn | undefined,
			};
		} else {
			log.alert(`no bunkerdata for room: ${this.room.print}`)
		}

		this.pos = (this.storage || this.terminal || this.spawns[0] || this.controller).pos;
		// Register physical objects across all rooms in the colony
		this.sources = _.sortBy(_.flatten(_.map(this.rooms, room => room.sources)),
											  source => source.pos.getMultiRoomRangeTo(this.pos));
		this.extractors = _(this.rooms)
				.map(room => room.extractor)
				.compact()
				.filter(e => (e!.my && e!.room.my)
							 || Cartographer.roomType(e!.room.name) != ROOMTYPE_CONTROLLER)
				.sortBy(e => e!.pos.getMultiRoomRangeTo(this.pos)).value() as StructureExtractor[];

		this.repairables = _.flatten(_.map(this.rooms, room => room.repairables))
		this.rechargeables = _.flatten(_.map(this.rooms, room => room.rechargeables))
		this.constructionSites = _.flatten(_.map(this.rooms, room => room.constructionSites))
		this.tombstones = _.flatten(_.map(this.rooms, room => room.tombstones))
		this.drops = _.merge(_.map(this.rooms, room => room.drops));

		// Register assets
		this.assets = this.computeAssets();

		// TODO check these
		// Register the rest of the colony components; the order in which these are called is important!
		this.registerOperationalState();
		this.refreshUtilities();
		_.forEach(this.hiveClusters, cluster => cluster.refresh())
	}

	get room(): Room {
		return Game.rooms[this.ref]
	}

	get storage(): StructureStorage | undefined {
		if (!this.room.storage) return undefined
		if (!this.room.storage.isActive()) return undefined

		return this.room.storage
	}

	get terminal(): StructureTerminal | undefined {
		if (!this.room.terminal) return undefined
		if (!this.room.terminal.isActive()) return undefined

		return this.room.terminal
	}

	get factory(): StructureFactory | undefined {
		if (!this.room.factory) return undefined
		if (!this.room.factory.isActive()) return undefined

		return this.room.factory
	}

	get controller(): StructureController {
		return this.room.controller!
	}
	
	/**
	 * Pretty-print the colony name in the console
	 */
	get print(): string {
		return '<a href="#!/room/' + Game.shard.name + '/' + this.room.name + '">[' + this.name + ']</a>';
	}

	/**
	 * Pretty-print the colony name right-padded with spaces to fit E**S** in the console
	 */
	get printAligned(): string {
		const msg = '<a href="#!/room/' + Game.shard.name + '/' + this.room.name + '">[' + this.name + ']</a>';
		const extraSpaces = 'E12S34'.length - this.room.name.length;
		return msg + ' '.repeat(extraSpaces);
	}

	toString(): string {
		return this.print;
	}

	protected debug(...args: any[]) {
		if (this.memory.debug) {
			log.alert(this.print, args);
		}
	}

	getSpawns(): StructureSpawn[] {
		return _.sortBy(_.filter(this.room.spawns,
			spawn => spawn.my && spawn.isActive()), spawn => spawn.ref)
	}

	getLabs(): StructureLab[] {
		return _.sortBy(_.filter(this.room.labs, lab => lab.my && lab.isActive()),
							 lab => 50 * lab.pos.y + lab.pos.x)
	}

	/**
	 * Registers the operational state of the colony, computing things like colony maturity, DEFCON level, etc.
	 */
	private registerOperationalState(): void {
		this.level = this.controller.level as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
		// Set colony stage
		if (this.storage && this.spawns[0]) { // TODO: remove colony stage
			if (this.controller.level == 8) {
				this.stage = ColonyStage.Adult;
			} else {
				this.stage = ColonyStage.Pupa;
			}
		} else {
			this.stage = ColonyStage.Larva;
		}
		// Set DEFCON level TODO: finish this
		let defcon = DEFCON.safe;
		const defconDecayTime = 200;
		if (this.room.dangerousHostiles.length > 0 && !this.controller.safeMode) {
			const effectiveHostileCount = _.sum(this.room.dangerousHostiles,
												hostile => CombatIntel.uniqueBoosts(hostile).length > 0 ? 2 : 1);
			if (effectiveHostileCount >= 3) {
				defcon = DEFCON.boostedInvasionNPC;
			} else {
				defcon = DEFCON.invasionNPC;
			}
		}
		if (this.memory.defcon) {
			if (defcon < this.memory.defcon.level) { // decay defcon level over time if defcon less than memory value
				if (this.memory.defcon.tick + defconDecayTime < Game.time) {
					this.memory.defcon.level = defcon;
					this.memory.defcon.tick = Game.time;
				}
			} else if (defcon > this.memory.defcon.level) { // refresh defcon time if it increases by a level
				this.memory.defcon.level = defcon;
				this.memory.defcon.tick = Game.time;
			}
		} else {
			this.memory.defcon = {
				level: defcon,
				tick : Game.time
			};
		}
		this.defcon = this.memory.defcon.level;

		// Set colony state to blank - other directives can modify this
		this.state = {};
		if (Energetics.lowPowerMode(this)) {
			this.state.lowPowerMode = true;
		}
	}

	/**
	 * Calls utility.refresh() for each registered utility
	 */
	private refreshUtilities(): void {
		this.linkNetwork.refresh();
		this.logisticsNetwork.refresh();
		this.transportRequests.refresh();
		this.roomPlanner.refresh();
		if (this.bunker) {
			if (this.bunker.topSpawn) {
				this.bunker.topSpawn = Game.getObjectById(this.bunker.topSpawn.id) as StructureSpawn | undefined;
			}
			if (this.bunker.coreSpawn) {
				this.bunker.coreSpawn = Game.getObjectById(this.bunker.coreSpawn.id) as StructureSpawn | undefined;
			}
			if (this.bunker.rightSpawn) {
				this.bunker.rightSpawn = Game.getObjectById(this.bunker.rightSpawn.id) as StructureSpawn | undefined;
			}
		}
		this.roadLogistics.refresh();
	}

	/**
	 * Builds hive clusters for each structural group in a colony
	 */
	private registerHiveClusters(): void {
		this.hiveClusters = [];
		// Instantiate the command center if there is storage in the room - this must be done first!
		if (this.storage) {
			this.commandCenter = new CommandCenter(this, this.storage);
		}
		// Instantiate the hatchery - the incubation directive assignes hatchery to incubator's hatchery if none exists
		const s = this.getSpawns()
		if (s.length > 0) {
			this.hatchery = new Hatchery(this, s[0]);
		}

		// Instantiate evolution chamber once there are three labs all in range 2 of each other
		const l = this.getLabs()
		if (this.terminal && _.filter(l, lab =>
			_.all(l, otherLab => lab.pos.inRangeTo(otherLab, 2))).length >= 3) {
			this.evolutionChamber = new EvolutionChamber(this, this.terminal);
		}

		// Instantiate the upgradeSite
		this.upgradeSite = new UpgradeSite(this, this.controller);

		// Instantiate spore crawlers to wrap towers
		if (this.room.towers.length > 0) {
			// passed tower is only used for position
			this.sporeCrawler = new SporeCrawler(this, this.room.towers[0]);
		}

		// Reverse the hive clusters for correct order for init() and run()
		this.hiveClusters.reverse();
	}

	/**
	 * Returns whether a room is part of this colony and is actively being maintained
	 */
	isRoomActive(roomName: string): boolean {
		if (roomName == this.room.name) {
			return true;
		} else if (!this.roomNames.includes(roomName)) {
			return false;
		} else {
			return this.memory.outposts[roomName] && this.memory.outposts[roomName].active;
		}
	}

	/**
	 * Deactivates an outpost and suspends operations in that room
	 */
	suspendOutpost(roomName: string, reason: OutpostDisableReason, duration: number): void {
		this.memory.outposts[roomName] = {
			active          : false,
			suspendReason   : reason,
			[MEM.EXPIRATION]: Game.time + duration
		};
	}

	private handleReactivatingOutposts(): void {
		for (const roomName in this.memory.outposts) {
			const outpostData = this.memory.outposts[roomName];
			if (!outpostData.active && Game.time >= (outpostData[MEM.EXPIRATION] || Infinity)) {
				this.memory.outposts[roomName] = {active: true};
			}
		}
	}

	/**
	 * Instantiate all overlords for the colony
	 */
	spawnMoarOverlords(): void {
		this.overlords = {
			default  : new DefaultOverlord(this),
			work     : new WorkerOverlord(this),
			logistics: new TransportOverlord(this),
		};
		if (!this.room.observer) {
			this.overlords.scout = new RandomWalkerScoutOverlord(this);
		}
		for (const hiveCluster of this.hiveClusters) {
			hiveCluster.spawnMoarOverlords();
		}
	}

	/**
	 * Get a list of creeps in the colony which have a specified role name
	 */
	getCreepsByRole(roleName: string): Creep[] {
		return this.creepsByRole[roleName] || [];
	}

	/**
	 * Get a list of zerg in the colony which have a specified role name
	 */
	getZergByRole(roleName: string): (Zerg | undefined)[] {
		return _.map(this.getCreepsByRole(roleName), creep => Overmind.zerg[creep.name]);
	}

	/**
	 * Summarizes the total of all resources in colony store structures, labs, and some creeps. Will always return
	 * 0 for an asset that it has none of (not undefined)
	 */
	private computeAssets(verbose = false): Assets {
		// Include storage structures, lab contents, and manager carry
		const assetStructures = _.compact([this.storage, this.terminal, this.factory, ...this.labs]);
		const assetCreeps = [...this.getCreepsByRole(Roles.queen), ...this.getCreepsByRole(Roles.manager)];
		const assetStores = _.map([...assetStructures, ...assetCreeps], thing => thing!.store);

		const allAssets = mergeSum([...assetStores, ALL_ZERO_ASSETS]) as Assets;

		if (verbose) log.debug(`${this.room.print} assets: ` + JSON.stringify(allAssets));
		return allAssets;
	}

	/**
	 * Initializes the state of the colony each tick
	 */
	init(): void {
		_.forEach(this.hiveClusters, hiveCluster => hiveCluster.init());	// Initialize each hive cluster
		this.roadLogistics.init();											// Initialize the road network
		this.linkNetwork.init();											// Initialize link network
		this.roomPlanner.init();											// Initialize the room planner
		if (Game.time % EXPANSION_EVALUATION_FREQ == 5 * this.id) {			// Re-evaluate expansion data if needed
			log.debug(`refreshExpansionData: ${this.room.name}`)
			ExpansionEvaluator.refreshExpansionData(this.memory.expansionData, this.room.name);
		}
	}

	/**
	 * Runs the colony, performing state-changing actions each tick
	 */
	run(): void {
		_.forEach(this.hiveClusters, hiveCluster => hiveCluster.run());		// Run each hive cluster
		this.linkNetwork.run();												// Run the link network
		this.roadLogistics.run();											// Run the road network
		this.roomPlanner.run();												// Run the room planner
		this.stats();														// Log stats per tick
	}

	/**
	 * Register colony-wide statistics
	 */
	stats(): void {
		if (Game.time % LOG_STATS_INTERVAL == 0) {
			// Log energy and rcl
			Stats.log(`colonies.${this.name}.storage.energy`, this.storage ? this.storage.energy : undefined);
			Stats.log(`colonies.${this.name}.rcl.level`, this.controller.level);
			Stats.log(`colonies.${this.name}.rcl.progress`, this.controller.progress);
			Stats.log(`colonies.${this.name}.rcl.progressTotal`, this.controller.progressTotal);
			// Log average miningSite usage and uptime and estimated colony energy income
			const numSites = _.keys(this.miningSites).length;
			const avgDowntime = _.sum(this.miningSites, site => site.memory[HARVEST_MEM.DOWNTIME]) / numSites;
			const avgUsage = _.sum(this.miningSites, site => site.memory[HARVEST_MEM.USAGE]) / numSites;
			const energyInPerTick = _.sum(this.miningSites,
										  site => site.overlords.mine.energyPerTick * site.memory[HARVEST_MEM.USAGE]);
			Stats.log(`colonies.${this.name}.miningSites.avgDowntime`, avgDowntime);
			Stats.log(`colonies.${this.name}.miningSites.avgUsage`, avgUsage);
			Stats.log(`colonies.${this.name}.miningSites.energyInPerTick`, energyInPerTick);
			Stats.log(`colonies.${this.name}.assets`, this.assets);
			// Log defensive properties
			Stats.log(`colonies.${this.name}.defcon`, this.defcon);
			Stats.log(`colonies.${this.name}.threatLevel`, this.room.threatLevel);
			const avgBarrierHits = _.sum(this.room.barriers, barrier => barrier.hits) / this.room.barriers.length;
			Stats.log(`colonies.${this.name}.avgBarrierHits`, avgBarrierHits);
		}
	}

	private drawCreepReport(coord: Coord): Coord {
		let {x, y} = coord;
		const roledata = Overmind.overseer.getCreepReport(this);
		const tablePos = new RoomPosition(x, y, this.room.name);
		y = Visualizer.infoBox(`${this.name} Creeps`, roledata, tablePos, 7);
		return {x, y};
	}

	visuals(): void {
		let x = 1;
		let y = 11.5;
		let coord: Coord;
		coord = this.drawCreepReport({x, y});
		x = coord.x;
		y = coord.y;

		for (const hiveCluster of _.compact([this.hatchery, this.commandCenter, this.evolutionChamber])) {
			coord = hiveCluster!.visuals({x, y});
			x = coord.x;
			y = coord.y;
		}
	}
}
