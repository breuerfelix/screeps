import {CombatSetups, Roles} from '../../creepSetups/setups';
import {DirectiveGuard} from '../../directives/defense/guard';
import {DirectiveHaul} from '../../directives/resource/haul';
import {DirectiveTargetSiege} from '../../directives/targeting/siegeTarget';
import {RoomIntel} from '../../intel/RoomIntel';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {CombatZerg} from '../../zerg/CombatZerg';
import {Overlord} from '../Overlord';

/**
 * NPC defense overlord: spawns specially-optimized guards as needed to deal with standard NPC invasions
 */
@profile
export class DefenseNPCOverlord extends Overlord {

	guards: CombatZerg[];

	static requiredRCL = 3;

	constructor(directive: DirectiveGuard, priority = OverlordPriority.outpostDefense.guard) {
		super(directive, 'guard', priority);
		this.guards = this.combatZerg(Roles.guardMelee);
	}

	private findAttackTarget(guard: CombatZerg): Creep | Structure | undefined | null {
		const targetingDirectives = DirectiveTargetSiege.find(guard.room.flags) as DirectiveTargetSiege[];
		const targetedStructures = _.compact(_.map(targetingDirectives,
												   directive => directive.getTarget())) as Structure[];
		if (targetedStructures.length > 0) {
			return guard.pos.findClosestByRange(targetedStructures);
		}
		if (guard.room.hostiles.length > 0) {
			const targets = _.filter(guard.room.hostiles, hostile => hostile.pos.rangeToEdge > 0);
			return guard.pos.findClosestByRange(targets);
		}
		if (guard.room.hostileStructures.length > 0) {
			const haulFlags = DirectiveHaul.find(guard.room.flags);
			if (haulFlags.length == 0) {
				return guard.pos.findClosestByRange(guard.room.hostileStructures);
			}
		}
	}

	/**
	 * Attack and chase the specified target
	 */
	private combatActions(guard: CombatZerg, target: Creep | Structure): void {
		// Attack the target if you can, else move to get in range
		guard.attackAndChase(target);
		// Heal yourself if it won't interfere with attacking
		guard.healSelfIfPossible();
	}

	private handleGuard(guard: CombatZerg): void {
		if (!guard.inSameRoomAs(this) || guard.pos.isEdge) {
			// Move into the assigned room if there is a guard flag present
			guard.goToRoom(this.pos.roomName);
		} else { // If you're in the assigned room or if there is no assignment, try to attack or heal
			const attackTarget = this.findAttackTarget(guard);
			if (attackTarget) {
				this.combatActions(guard, attackTarget);
			} else {
				guard.doMedicActions(this.pos.roomName);
			}
		}
	}

	init() {
		// always wishlist one guard since if the attack killed every creep i have no vision of the room
		this.wishlist(1, CombatSetups.broodlings.default, {reassignIdle: true});
	}

	run() {
		this.autoRun(this.guards, guard => this.handleGuard(guard))
	}
}
