// Sandbox code: lets you try out random stuff at the end of main loop

import {log} from '../console/log';
import {PackratTests} from './packrat';

export function sandbox() {
	try {
		global.PackratTests = PackratTests;
	} catch (e) {
		log.error(e);
	}
}
