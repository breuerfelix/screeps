import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

export type rangedAttackTargetType = Creep | Structure;
export const rangedAttackTaskName = 'rangedAttack';

@profile
export class TaskRangedAttack extends Task<rangedAttackTargetType> {

	constructor(target: rangedAttackTargetType, options = {} as TaskOptions) {
		super(rangedAttackTaskName, target, options);
		// Settings
		this.settings.targetRange = 3;
	}

	isValidTask() {
		return this.creep.getActiveBodyparts(RANGED_ATTACK) > 0;
	}

	isValidTarget() {
		return !!this.target && this.target.hits > 0;
	}

	work() {
		if (!this.target) return ERR_INVALID_TARGET;
		return this.creep.rangedAttack(this.target);
	}
}

