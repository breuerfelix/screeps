import {CombatIntel} from '../intel/CombatIntel';
import {CombatMoveOptions, Movement} from '../movement/Movement';
import {profile} from '../profiler/decorator';
import {CombatTargeting} from '../targeting/CombatTargeting';
import {GoalFinder} from '../targeting/GoalFinder';
import {randomHex} from '../utilities/utils';
import {Zerg} from './Zerg';

interface CombatZergMemory extends CreepMemory {
	recovering: boolean;
	lastInDanger: number;
	partner?: string;
	swarm?: string;
}

export const DEFAULT_PARTNER_TICK_DIFFERENCE = 650;
export const DEFAULT_SWARM_TICK_DIFFERENCE = 500;

/**
 * CombatZerg is an extension of the Zerg class which contains additional combat-related methods
 */
@profile
export class CombatZerg extends Zerg {

	memory: CombatZergMemory;
	isCombatZerg: boolean;

	constructor(creep: Creep, notifyWhenAttacked = true) {
		super(creep, notifyWhenAttacked);
		this.isCombatZerg = true;
		_.defaults(this.memory, {
			recovering  : false,
			lastInDanger: 0,
			targets     : {}
		});
	}

	findPartner(partners: CombatZerg[], tickDifference = DEFAULT_PARTNER_TICK_DIFFERENCE): CombatZerg | undefined {
		if (this.memory.partner) {
			const partner = _.find(partners, partner => partner.name == this.memory.partner);
			if (partner) {
				return partner;
			} else {
				delete this.memory.partner;
				this.findPartner(partners, tickDifference);
			}
		} else {
			let partner = _.find(partners, partner => partner.memory.partner == this.name);
			if (!partner) {
				partner = _(partners)
					.filter(partner => !partner.memory.partner &&
									   Math.abs((this.ticksToLive || CREEP_LIFE_TIME)
												- (partner.ticksToLive || CREEP_LIFE_TIME)) <= tickDifference)
					.min(partner => Math.abs((this.ticksToLive || CREEP_LIFE_TIME)
											 - (partner.ticksToLive || CREEP_LIFE_TIME)));
			}
			if (_.isObject(partner)) {
				this.memory.partner = partner.name;
				partner.memory.partner = this.name;
				return partner;
			}
		}

		return undefined
	}

	findSwarm(partners: CombatZerg[], maxByRole: { [role: string]: number },
			  tickDifference = DEFAULT_SWARM_TICK_DIFFERENCE): string | undefined {
		if (this.memory.swarm) {
			return this.memory.swarm;
		} else {
			// Find a swarm that isn't too old and that has space for the creep's role
			const partnersBySwarm = _.groupBy(partners, partner => partner.memory.swarm);
			for (const swarmRef in partnersBySwarm) {
				if (swarmRef == undefined || swarmRef == 'undefined') continue;
				if (_.all(partnersBySwarm[swarmRef],
						  c => Math.abs((this.ticksToLive || CREEP_LIFE_TIME)
										- (c.ticksToLive || CREEP_LIFE_TIME)) <= tickDifference)) {
					const swarmCreepsByRole = _.groupBy(partnersBySwarm[swarmRef], c => c.memory.role);
					if ((swarmCreepsByRole[this.memory.role] || []).length + 1 <= maxByRole[this.memory.role]) {
						this.memory.swarm = swarmRef;
						return swarmRef;
					}
				}
			}
			// Otherwise just make a new swarm ref
			const newSwarmRef = randomHex(6);
			this.memory.swarm = newSwarmRef;
			return newSwarmRef;
		}
	}

	/**
	 * Returns true if there is a target for medic actions, otherwise false
	 */
	doMedicActions(roomName: string): boolean {
		// Travel to the target room
		if (!this.safelyInRoom(roomName)) {
			this.goToRoom(roomName, {pathOpts: {ensurePath: true}});
			return true; // en route
		}
		// Heal friendlies
		const target = CombatTargeting.findClosestHurtFriendly(this);
		if (target) {
			// Approach the target
			const range = this.pos.getRangeTo(target);
			if (range > 1) {
				this.goTo(target, {movingTarget: true});
			}

			// Heal or ranged-heal the target
			if (range <= 1) {
				this.heal(target);
			} else if (range <= 3) {
				this.rangedHeal(target);
			}
		} else {
			this.park();
		}
		return !!target;
	}

	healSelfIfPossible(): CreepActionReturnCode | undefined {
		// Heal yourself if it won't interfere with attacking
		if (this.canExecute('heal')
			&& (this.hits < this.hitsMax || this.pos.findInRange(this.room.hostiles, 3).length > 0)) {
			return this.heal(this);
		}

		return undefined
	}

	/**
	 * Attack and chase the specified target
	 */
	attackAndChase(target: Creep | Structure): CreepActionReturnCode {
		let ret: CreepActionReturnCode;
		// Attack the target if you can, else move to get in range
		if (this.pos.isNearTo(target)) {
			ret = this.attack(target);
			// Move in the direction of the creep to prevent it from running away
			this.move(this.pos.getDirectionTo(target));
			return ret;
		} else {
			if (this.pos.getRangeTo(target.pos) > 10 && target instanceof Creep) {
				this.goTo(target, {movingTarget: true});
			} else {
				this.goTo(target);
			}
			return ERR_NOT_IN_RANGE;
		}
	}

	// Standard action sequences for engaging small numbers of enemies in a neutral room ===============================

	/**
	 * Automatically melee-attack the best creep in range
	 */
	autoMelee(possibleTargets = this.room.hostiles) {
		const target = CombatTargeting.findBestCreepTargetInRange(this, 1, possibleTargets)
					   || CombatTargeting.findBestStructureTargetInRange(this, 1);
		this.debug(`Melee target: ${target}`);
		if (target) {
			return this.attack(target);
		}

		return undefined
	}

	/**
	 * Automatically ranged-attack the best creep in range
	 */
	autoRanged(possibleTargets = this.room.hostiles, allowMassAttack = true) {
		const target = CombatTargeting.findBestCreepTargetInRange(this, 3, possibleTargets)
					   || CombatTargeting.findBestStructureTargetInRange(this, 3, false);
		// disabled allowUnowned structure attack in order not to desrtory poison walls
		this.debug(`Ranged target: ${target}`);
		if (target) {
			if (allowMassAttack
				&& CombatIntel.getMassAttackDamage(this, possibleTargets) > CombatIntel.getRangedAttackDamage(this)) {
				return this.rangedMassAttack();
			} else {
				return this.rangedAttack(target);
			}
		}

		return undefined
	}

	private kiteIfNecessary() { // Should filter by melee at some point
		const nearbyHostiles = _.filter(this.room.dangerousHostiles, c => this.pos.inRangeToXY(c.pos.x, c.pos.y, 2));
		if (nearbyHostiles.length && !this.inRampart) {
			// this.say('run!');
			this.rangedMassAttack();
			return this.kite(nearbyHostiles);
		}

		return undefined
	}

	/**
	 * Automatically heal the best creep in range
	 */
	autoHeal(allowRangedHeal = true, friendlies = this.room.creeps) {
		const target = CombatTargeting.findBestHealingTargetInRange(this, allowRangedHeal ? 3 : 1, friendlies);
		this.debug(`Heal target: ${target}`);
		if (target) {
			if (this.pos.getRangeTo(target) <= 1) {
				return this.heal(target);
			} else if (allowRangedHeal && this.pos.getRangeTo(target) <= 3) {
				return this.rangedHeal(target);
			}
		}

		return undefined
	}

	/**
	 * Navigate to a room, then engage hostile creeps there, perform medic actions, etc.
	 */
	autoSkirmish(roomName: string, verbose = false) {

		// Do standard melee, ranged, and heal actions
		if (this.getActiveBodyparts(ATTACK) > 0) {
			this.autoMelee(); // Melee should be performed first
		}
		if (this.getActiveBodyparts(RANGED_ATTACK) > 0) {
			this.autoRanged();
		}
		if (this.canExecute('heal')) {
			this.autoHeal(this.canExecute('rangedHeal'));
		}

		// Handle recovery if low on HP
		if (this.needsToRecover()) {
			this.debug(`Recovering!`);
			return this.recover();
		}

		// Travel to the target room
		if (!this.safelyInRoom(roomName)) {
			this.debug(`Going to room!`);
			return this.goToRoom(roomName, {pathOpts: {ensurePath: true}});
		}

		// Skirmish within the room
		const goals = GoalFinder.skirmishGoals(this);
		this.debug(JSON.stringify(goals));
		return Movement.combatMove(this, goals.approach, goals.avoid);
	}

	/**
	 * Navigate to a room, then engage hostile creeps there, perform medic actions, etc.
	 */
	autoCombat(roomName: string, verbose = false, preferredRange?: number, options?: CombatMoveOptions) {

		// Do standard melee, ranged, and heal actions
		if (this.getActiveBodyparts(ATTACK) > 0) {
			this.autoMelee(); // Melee should be performed first
		}
		if (this.getActiveBodyparts(RANGED_ATTACK) > 0) {
			this.autoRanged();
		}
		if (this.canExecute('heal')) {
			this.autoHeal(this.canExecute('rangedHeal'));
		}

		// Handle recovery if low on HP
		if (this.needsToRecover()) {
			this.debug(`Recovering!`);
			return this.recover();
		}

		// Travel to the target room
		if (!this.safelyInRoom(roomName)) {
			this.debug(`Going to room!`);
			return this.goToRoom(roomName, {pathOpts: {ensurePath: true}});
		}

		// Fight within the room
		const target = CombatTargeting.findTarget(this);
		const preferRanged = this.getActiveBodyparts(RANGED_ATTACK) > this.getActiveBodyparts(ATTACK);
		const targetRange = preferredRange || preferRanged ? 3 : 1;
		this.debug(`${target}, ${targetRange}`);
		if (target) {
			const avoid = [];
			// Avoid melee hostiles if you are a ranged creep
			if (preferRanged) {
				const meleeHostiles = _.filter(this.room.hostiles, h => CombatIntel.getAttackDamage(h) > 0);
				for (const hostile of meleeHostiles) {
					avoid.push({pos: hostile.pos, range: targetRange - 1});
				}
				if (this.kiteIfNecessary()) {
					return;
				}
			}
			return Movement.combatMove(this, [{pos: target.pos, range: targetRange}], avoid, options);
		}

		return undefined
	}

	autoBunkerCombat(roomName: string, verbose = false) {
		if (this.getActiveBodyparts(ATTACK) > 0) {
			this.autoMelee(); // Melee should be performed first
		}
		if (this.getActiveBodyparts(RANGED_ATTACK) > 0) {
			this.autoRanged();
		}

		// Travel to the target room
		if (!this.safelyInRoom(roomName)) {
			this.debug(`Going to room!`);
			return this.goToRoom(roomName, {pathOpts: {ensurePath: true}});
		}

		// TODO check if right colony, also yes colony check is in there to stop red squigglies
		// const siegingCreeps = this.room.hostiles.filter(creep =>
		// 	_.any(creep.pos.neighbors, pos => this.colony && insideBunkerBounds(pos, this.colony)));

		const target = CombatTargeting.findTarget(this, this.colony ? this.room.playerHostiles
																		  .filter(creep => creep.pos.getRangeTo(this.colony!.pos) <= 9) : this.room.dangerousHostiles);

		if (target) {
			return Movement.combatMove(this, [{pos: target.pos, range: 1}], [], {
				preferRamparts : true,
				requireRamparts: true
			});
		}

		return undefined
	}

	needsToRecover(recoverThreshold  = CombatIntel.minimumDamageTakenMultiplier(this.creep) < 1 ? 0.85 : 0.75,
				   reengageThreshold = 1.0): boolean {
		let recovering: boolean;
		if (this.memory.recovering) {
			recovering = this.hits < this.hitsMax * reengageThreshold;
		} else {
			recovering = this.hits < this.hitsMax * recoverThreshold;
		}
		this.memory.recovering = recovering;
		return recovering;
	}

	/**
	 * Retreat and get healed
	 */
	recover() {
		if (this.pos.findInRange(this.room.hostiles, 5).length > 0 || this.room.towers.length > 0) {
			this.memory.lastInDanger = Game.time;
		}
		const goals = GoalFinder.retreatGoals(this);
		const result = Movement.combatMove(this, goals.approach, goals.avoid, {allowExit: true});

		if (result == NO_ACTION && this.pos.isEdge) {
			if (Game.time < this.memory.lastInDanger + 3) {
				return this.moveOffExit();
			}
		}
		return result;
	}


}
