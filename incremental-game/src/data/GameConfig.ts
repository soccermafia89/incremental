import * as yaml from 'js-yaml'
import asteroidsYaml from './asteroid/asteroids.yaml?raw'
import { parseAsteroids, type AsteroidConfig } from './asteroid'
import bankYaml from './bank/bank.yaml?raw'
import { parseBank, type BankConfig } from './bank'
import fighterYaml from './fighter/fighter.yaml?raw'
import { parseFighter, type FighterConfig } from './fighter'
import fighterUpgradesYaml from './fighter/upgrades.yaml?raw'
import { parseFighterUpgrades, type FighterUpgradeTable } from './fighter/upgrades'
import enemyUpgradesYaml from './enemy/upgrades.yaml?raw'
import { parseEnemyUpgrades, type EnemyUpgradeTable } from './enemy/upgrades'
import goldenYaml from './golden/golden.yaml?raw'
import { parseGolden, type GoldenConfig } from './golden'
import mapYaml from './map/map.yaml?raw'
import { parseMapLayout, type MapLayoutConfig } from './map'
import miningYaml from './mining/mining.yaml?raw'
import { parseMining, type MiningTable } from './mining'
import oreYaml from './ore/ore.yaml?raw'
import { parseOre, type OreConfig } from './ore'
import rivalYaml from './rival/rival.yaml?raw'
import { parseRival, type RivalConfig } from './rival'
import shipsYaml from './ship/ships.yaml?raw'
import { parseShips, type ShipConfig } from './ship'
import upgradesYaml from './upgrades/upgrades.yaml?raw'
import { parseUpgradeTable, type UpgradeTable } from './upgrades'

/** One object the match is built from. Each field is that module's own file. */
export interface GameConfig {
  map: MapLayoutConfig
  asteroids: AsteroidConfig
  golden: GoldenConfig
  ships: ShipConfig
  fighter: FighterConfig
  fighterUpgrades: FighterUpgradeTable
  enemyUpgrades: EnemyUpgradeTable
  rival: RivalConfig
  ore: OreConfig
  bank: BankConfig
  upgrades: UpgradeTable
  mining: MiningTable
}

let cached: GameConfig | null = null

export function loadGameConfig(): GameConfig {
  if (cached) return cached
  cached = {
    map: load(mapYaml, parseMapLayout),
    asteroids: load(asteroidsYaml, parseAsteroids),
    golden: load(goldenYaml, parseGolden),
    ships: load(shipsYaml, parseShips),
    fighter: load(fighterYaml, parseFighter),
    fighterUpgrades: load(fighterUpgradesYaml, parseFighterUpgrades),
    enemyUpgrades: load(enemyUpgradesYaml, parseEnemyUpgrades),
    rival: load(rivalYaml, parseRival),
    ore: load(oreYaml, parseOre),
    bank: load(bankYaml, parseBank),
    upgrades: load(upgradesYaml, parseUpgradeTable),
    mining: load(miningYaml, parseMining),
  }
  return cached
}

function load<T>(file: string, parse: (raw: unknown) => T): T {
  return parse(yaml.load(file))
}
