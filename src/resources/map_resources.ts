export const RESOURCE_IMPORTANCE = [
	RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
	RESOURCE_CATALYZED_GHODIUM_ACID,
	RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE,
	RESOURCE_CATALYZED_ZYNTHIUM_ACID,
	RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE,
	RESOURCE_CATALYZED_LEMERGIUM_ACID,
	RESOURCE_CATALYZED_KEANIUM_ALKALIDE,
	RESOURCE_CATALYZED_KEANIUM_ACID,
	RESOURCE_CATALYZED_UTRIUM_ALKALIDE,
	RESOURCE_CATALYZED_UTRIUM_ACID,

	RESOURCE_POWER,

	RESOURCE_GHODIUM_ALKALIDE,
	RESOURCE_GHODIUM_ACID,
	RESOURCE_ZYNTHIUM_ALKALIDE,
	RESOURCE_ZYNTHIUM_ACID,
	RESOURCE_LEMERGIUM_ALKALIDE,
	RESOURCE_LEMERGIUM_ACID,
	RESOURCE_KEANIUM_ALKALIDE,
	RESOURCE_KEANIUM_ACID,
	RESOURCE_UTRIUM_ALKALIDE,
	RESOURCE_UTRIUM_ACID,

	RESOURCE_GHODIUM_OXIDE,
	RESOURCE_GHODIUM_HYDRIDE,
	RESOURCE_ZYNTHIUM_OXIDE,
	RESOURCE_ZYNTHIUM_HYDRIDE,
	RESOURCE_LEMERGIUM_OXIDE,
	RESOURCE_LEMERGIUM_HYDRIDE,
	RESOURCE_KEANIUM_OXIDE,
	RESOURCE_KEANIUM_HYDRIDE,
	RESOURCE_UTRIUM_OXIDE,
	RESOURCE_UTRIUM_HYDRIDE,

	RESOURCE_UTRIUM_LEMERGITE,
	RESOURCE_ZYNTHIUM_KEANITE,
	RESOURCE_HYDROXIDE,

	RESOURCE_GHODIUM,
	RESOURCE_CATALYST,
	RESOURCE_ZYNTHIUM,
	RESOURCE_LEMERGIUM,
	RESOURCE_KEANIUM,
	RESOURCE_UTRIUM,
	RESOURCE_OXYGEN,
	RESOURCE_HYDROGEN,

	RESOURCE_ENERGY,
];

export const BASE_RESOURCES = [
	RESOURCE_GHODIUM,
	RESOURCE_CATALYST,
	RESOURCE_ZYNTHIUM,
	RESOURCE_LEMERGIUM,
	RESOURCE_KEANIUM,
	RESOURCE_UTRIUM,
	RESOURCE_OXYGEN,
	RESOURCE_HYDROGEN,
];

export const REAGENTS: { [product: string]: [ResourceConstant, ResourceConstant] } = {
	// Tier 3
	[RESOURCE_CATALYZED_GHODIUM_ALKALIDE]  : [RESOURCE_GHODIUM_ALKALIDE, RESOURCE_CATALYST],
	[RESOURCE_CATALYZED_GHODIUM_ACID]      : [RESOURCE_GHODIUM_ACID, RESOURCE_CATALYST],
	[RESOURCE_CATALYZED_ZYNTHIUM_ACID]     : [RESOURCE_ZYNTHIUM_ACID, RESOURCE_CATALYST],
	[RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE] : [RESOURCE_ZYNTHIUM_ALKALIDE, RESOURCE_CATALYST],
	[RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE]: [RESOURCE_LEMERGIUM_ALKALIDE, RESOURCE_CATALYST],
	[RESOURCE_CATALYZED_LEMERGIUM_ACID]    : [RESOURCE_LEMERGIUM_ACID, RESOURCE_CATALYST],
	[RESOURCE_CATALYZED_KEANIUM_ALKALIDE]  : [RESOURCE_KEANIUM_ALKALIDE, RESOURCE_CATALYST],
	[RESOURCE_CATALYZED_KEANIUM_ACID]      : [RESOURCE_KEANIUM_ACID, RESOURCE_CATALYST],
	[RESOURCE_CATALYZED_UTRIUM_ACID]       : [RESOURCE_UTRIUM_ACID, RESOURCE_CATALYST],
	[RESOURCE_CATALYZED_UTRIUM_ALKALIDE]   : [RESOURCE_UTRIUM_ALKALIDE, RESOURCE_CATALYST],
	// Tier 2
	[RESOURCE_GHODIUM_ACID]                : [RESOURCE_GHODIUM_HYDRIDE, RESOURCE_HYDROXIDE],
	[RESOURCE_GHODIUM_ALKALIDE]            : [RESOURCE_GHODIUM_OXIDE, RESOURCE_HYDROXIDE],
	[RESOURCE_ZYNTHIUM_ACID]               : [RESOURCE_ZYNTHIUM_HYDRIDE, RESOURCE_HYDROXIDE],
	[RESOURCE_ZYNTHIUM_ALKALIDE]           : [RESOURCE_ZYNTHIUM_OXIDE, RESOURCE_HYDROXIDE],
	[RESOURCE_LEMERGIUM_ALKALIDE]          : [RESOURCE_LEMERGIUM_OXIDE, RESOURCE_HYDROXIDE],
	[RESOURCE_LEMERGIUM_ACID]              : [RESOURCE_LEMERGIUM_HYDRIDE, RESOURCE_HYDROXIDE],
	[RESOURCE_KEANIUM_ALKALIDE]            : [RESOURCE_KEANIUM_OXIDE, RESOURCE_HYDROXIDE],
	[RESOURCE_KEANIUM_ACID]                : [RESOURCE_KEANIUM_HYDRIDE, RESOURCE_HYDROXIDE],
	[RESOURCE_UTRIUM_ACID]                 : [RESOURCE_UTRIUM_HYDRIDE, RESOURCE_HYDROXIDE],
	[RESOURCE_UTRIUM_ALKALIDE]             : [RESOURCE_UTRIUM_OXIDE, RESOURCE_HYDROXIDE],
	// Tier 1
	[RESOURCE_GHODIUM_HYDRIDE]             : [RESOURCE_GHODIUM, RESOURCE_HYDROGEN],
	[RESOURCE_GHODIUM_OXIDE]               : [RESOURCE_GHODIUM, RESOURCE_OXYGEN],
	[RESOURCE_ZYNTHIUM_HYDRIDE]            : [RESOURCE_ZYNTHIUM, RESOURCE_HYDROGEN],
	[RESOURCE_ZYNTHIUM_OXIDE]              : [RESOURCE_ZYNTHIUM, RESOURCE_OXYGEN],
	[RESOURCE_LEMERGIUM_OXIDE]             : [RESOURCE_LEMERGIUM, RESOURCE_OXYGEN],
	[RESOURCE_LEMERGIUM_HYDRIDE]           : [RESOURCE_LEMERGIUM, RESOURCE_HYDROGEN],
	[RESOURCE_KEANIUM_OXIDE]               : [RESOURCE_KEANIUM, RESOURCE_OXYGEN],
	[RESOURCE_KEANIUM_HYDRIDE]             : [RESOURCE_KEANIUM, RESOURCE_HYDROGEN],
	[RESOURCE_UTRIUM_HYDRIDE]              : [RESOURCE_UTRIUM, RESOURCE_HYDROGEN],
	[RESOURCE_UTRIUM_OXIDE]                : [RESOURCE_UTRIUM, RESOURCE_OXYGEN],
	// Tier 0
	[RESOURCE_GHODIUM]                     : [RESOURCE_ZYNTHIUM_KEANITE, RESOURCE_UTRIUM_LEMERGITE],
	[RESOURCE_HYDROXIDE]                   : [RESOURCE_OXYGEN, RESOURCE_HYDROGEN],
	[RESOURCE_ZYNTHIUM_KEANITE]            : [RESOURCE_ZYNTHIUM, RESOURCE_KEANIUM],
	[RESOURCE_UTRIUM_LEMERGITE]            : [RESOURCE_UTRIUM, RESOURCE_LEMERGIUM]
};

export const boostParts: { [boostType: string]: BodyPartConstant } = {

	UH: ATTACK,
	UO: WORK,
	KH: CARRY,
	KO: RANGED_ATTACK,
	LH: WORK,
	LO: HEAL,
	ZH: WORK,
	ZO: MOVE,
	GH: WORK,
	GO: TOUGH,

	UH2O: ATTACK,
	UHO2: WORK,
	KH2O: CARRY,
	KHO2: RANGED_ATTACK,
	LH2O: WORK,
	LHO2: HEAL,
	ZH2O: WORK,
	ZHO2: MOVE,
	GH2O: WORK,
	GHO2: TOUGH,

	XUH2O: ATTACK,
	XUHO2: WORK,
	XKH2O: CARRY,
	XKHO2: RANGED_ATTACK,
	XLH2O: WORK,
	XLHO2: HEAL,
	XZH2O: WORK,
	XZHO2: MOVE,
	XGH2O: WORK,
	XGHO2: TOUGH,

};

export const boostResources: { [actionName: string]: { [boostLevel: number]: _ResourceConstantSansEnergy } } = {
	attack       : {
		1: 'UH',
		2: 'UH2O',
		3: 'XUH2O',
	},
	carry        : {
		1: 'KH',
		2: 'KH2O',
		3: 'XKH2O',
	},
	ranged_attack: {
		1: 'KO',
		2: 'KHO2',
		3: 'XKHO2',
	},
	heal         : {
		1: 'LO',
		2: 'LHO2',
		3: 'XLHO2',
	},
	move         : {
		1: 'ZO',
		2: 'ZHO2',
		3: 'XZHO2',
	},
	tough        : {
		1: 'GO',
		2: 'GHO2',
		3: 'XGHO2',
	},
	harvest      : {
		1: 'UO',
		2: 'UHO2',
		3: 'XUHO2',
	},
	construct    : {
		1: 'LH',
		2: 'LH2O',
		3: 'XLH2O',
	},
	dismantle    : {
		1: 'ZH',
		2: 'ZH2O',
		3: 'XZH2O',
	},
	upgrade      : {
		1: 'GH',
		2: 'GH2O',
		3: 'XGH2O',
	},

};

