import { dateToDbIndex } from "@/db";
import { customBattleModes } from "@/utils/wot";
import { MaybeRefOrGetter, ShallowRef, ref, shallowRef, toValue, watchEffect } from "vue";
import { useRoute } from "vue-router";

export type TankType = 'LT' | 'MT' | 'HT' | 'AT' | 'SPG';
export type TankLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type StatParams = {
  player: string | null;
  level: TankLevel[] | null;
  types: TankType[] | null;
  tanks: string[] | null;
  battleMode: keyof typeof customBattleModes | 'any';
  period: 'allTime' | {
    type: 'lastX'
    count: number
  } | {
    type: 'fromTo',
    from: Date,
    to: Date
  } | {
    type: 'fromToNow',
    from: Date
  },
  battleId: string[] | null;
};

export function useQueryStatParams() {
  const route = useRoute();

  const result = ref<StatParams>({
    period: 'allTime',
    player: null,
    level: null,
    types: null,
    tanks: null,
    battleMode: 'normalAny',
    battleId: null
  })

  watchEffect(() => {

    const temp: StatParams = {
      period: 'allTime',
      player: null,
      level: null,
      types: null,
      tanks: null,
      battleMode: 'normalAny',
      battleId: null
    }

    if ('nickname' in route.query) temp.player = route.query.nickname as string;
    if ('level' in route.query) {
      const level = route.query.level as string;
      const splitted = level.split(',');
      temp.level = splitted
        .map(t => parseInt(t))
        .filter(t => !isNaN(t))
        .filter(t => t >= 1 && t <= 10) as TankLevel[];
    }

    if ('mode' in route.query) {
      const battleMode = route.query.mode as string;

      if (battleMode === 'any') {
        temp.battleMode = 'any';
      } else if (battleMode in customBattleModes) {
        temp.battleMode = battleMode as keyof typeof customBattleModes;
      }
    }

    if ('type' in route.query) {
      const type = route.query.type as string;
      const splitted = type.split(',');
      temp.types = splitted
        .filter(t => ['LT', 'MT', 'HT', 'AT', 'SPG'].includes(t)) as TankType[];
    }

    if ('tank' in route.query) {
      const tank = route.query.tank as string;
      const splitted = tank.split(',');
      temp.tanks = splitted;
    }

    if ('battleId' in route.query) {
      const battleId = route.query.battleId as string;
      const splitted = battleId.split(',');
      temp.battleId = splitted;
    } else if ('lastX' in route.query) {
      const lastX = route.query.lastX as string;
      const count = parseInt(lastX);
      if (!isNaN(count)) {
        temp.period = {
          type: 'lastX',
          count
        }
      }
    } else if ('from' in route.query && 'to' in route.query) {
      const from = new Date(route.query.from as string);
      const to = new Date(route.query.to as string);
      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
        temp.period = {
          type: 'fromTo',
          from,
          to
        }
      }
    } else if ('from' in route.query) {
      const from = new Date(route.query.from as string);
      if (!isNaN(from.getTime())) {
        temp.period = {
          type: 'fromToNow',
          from
        }
      }
    }

    result.value = temp;

  })
  return result;
}

function whereClauseArray(params: StatParams, ignore: ('player' | 'level' | 'types' | 'tanks')[] = []) {
  const result: string[] = [];
  if (!ignore.includes('player') && params.player) result.push(`playerName = '${params.player}'`);
  if (!ignore.includes('level') && params.level) result.push(`tankLevel in (${params.level.join(', ')})`);
  if (!ignore.includes('types') && params.types) result.push(`tankType in ('${params.types.join("', '")}')`);
  if (!ignore.includes('tanks') && params.tanks) result.push(`tankTag in ('${params.tanks.join("', '")}')`);
  if (params.battleId === null && params.battleMode !== 'any') {
    const t = customBattleModes[params.battleMode];
    if ('mode' in t) result.push(`battleMode = '${t.mode}'`);
    if ('gameplay' in t) result.push(`battleGameplay = '${t.gameplay}'`);
  }
  return result;
}

export function whereClause(params: MaybeRefOrGetter<StatParams>, options: Partial<{
  withWhere: boolean, isBattleStart: boolean, ignore: ('player' | 'level' | 'types' | 'tanks')[]
}> = { withWhere: true, isBattleStart: false, ignore: [] }) {
  const { withWhere, isBattleStart, ignore } = options;

  const valueParams = toValue(params);
  const result: string[] = whereClauseArray(valueParams, ignore)

  if (valueParams.battleId && valueParams.battleId.length > 0) {
    result.push(`${isBattleStart ? 'id' : 'onBattleStartId'} in (${valueParams.battleId.map(t => `'${t}'`).join(', ')})`);
  } else if (valueParams.period !== 'allTime') {
    if (valueParams.period.type == 'fromTo') {
      result.push(`id >= ${dateToDbIndex(valueParams.period.from)}`);
      result.push(`id <= ${dateToDbIndex(valueParams.period.to)}`);
    } else if (valueParams.period.type == 'fromToNow') {
      result.push(`id >= ${dateToDbIndex(valueParams.period.from)}`);
    } else if (valueParams.period.type == 'lastX') {
      const whereClause = whereClauseArray(valueParams, ignore);
      const lastIDs = `(select id from Event_OnBattleStart ${whereClause.length == 0 ? '' : `where ${whereClause.join(' AND ')}`} order by id desc limit ${valueParams.period.count})`;
      result.push(`${isBattleStart ? 'id' : 'onBattleStartId'} in ${lastIDs}`);
    }
  }

  return result.length == 0 ? '' : (withWhere === false ? ' and ' : 'where ') + result.join(' AND ');
}