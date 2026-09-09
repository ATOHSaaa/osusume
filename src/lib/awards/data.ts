import akutagawaPrize from '../../data/akutagawa-prize.json';
import akutagawaNominee from '../../data/akutagawa-nominee.json';
import naokiPrize from '../../data/naoki-prize.json';
import naokiNominee from '../../data/naoki-nominee.json';
import honyaTaishoPrize from '../../data/honya-taisho-prize.json';
import honyaTaishoNominee from '../../data/honya-taisho-nominee.json';
import yoshikawaEijiPrize from '../../data/yoshikawa-eiji-prize.json';
import yoshikawaEijiNominee from '../../data/yoshikawa-eiji-nominee.json';
import nomaBungeiPrize from '../../data/noma-bungei-prize.json';
import nomaBungeiNominee from '../../data/noma-bungei-nominee.json';
import tanizakiJunichiroPrize from '../../data/tanizaki-junichiro-prize.json';
import tanizakiJunichiroNominee from '../../data/tanizaki-junichiro-nominee.json';
import yomiuriPrize from '../../data/yomiuri-prize.json';
import joryuBungeiPrize from '../../data/joryu-bungei-prize.json';
import edogawaRanpoPrize from '../../data/edogawa-ranpo-prize.json';
import edogawaRanpoNominee from '../../data/edogawa-ranpo-nominee.json';
import honkakuMysteryPrize from '../../data/honkaku-mystery-prize.json';
import mephistoPrize from '../../data/mephisto-prize.json';
import kawabataPrize from '../../data/kawabata-prize.json';
import kawabataNominee from '../../data/kawabata-nominee.json';
import japanSfPrize from '../../data/japan-sf-prize.json';
import yamamotoShugoroPrize from '../../data/yamamoto-shugoro-prize.json';
import shibataRentaroPrize from '../../data/shibata-rentaro-prize.json';
import bungakuKaiPrize from '../../data/bungaku-kai-prize.json';
import shinchoPrize from '../../data/shincho-prize.json';
import bungeiPrize from '../../data/bungei-prize.json';
import allYomimonoPrize from '../../data/all-yomimono-prize.json';
import subaruPrize from '../../data/subaru-prize.json';
import gunzoPrize from '../../data/gunzo-prize.json';
import dazaiOsamuPrize from '../../data/dazai-osamu-prize.json';
import kaikoKenPrize from '../../data/kaiko-ken-prize.json';
import type { NomineeDataFile, PrizeDataFile } from './types';

const PRIZE_DATA: Record<string, PrizeDataFile> = {
  akutagawa: akutagawaPrize,
  naoki: naokiPrize,
  'honya-taisho': honyaTaishoPrize,
  'yoshikawa-eiji': yoshikawaEijiPrize,
  'noma-bungei': nomaBungeiPrize,
  'tanizaki-junichiro': tanizakiJunichiroPrize,
  yomiuri: yomiuriPrize,
  'joryu-bungei': joryuBungeiPrize,
  'edogawa-ranpo': edogawaRanpoPrize,
  'honkaku-mystery': honkakuMysteryPrize,
  mephisto: mephistoPrize,
  kawabata: kawabataPrize,
  'japan-sf': japanSfPrize,
  'yamamoto-shugoro': yamamotoShugoroPrize,
  'shibata-rentaro': shibataRentaroPrize,
  'bungaku-kai': bungakuKaiPrize,
  shincho: shinchoPrize,
  bungei: bungeiPrize,
  'all-yomimono': allYomimonoPrize,
  subaru: subaruPrize,
  gunzo: gunzoPrize,
  'dazai-osamu': dazaiOsamuPrize,
  'kaiko-ken': kaikoKenPrize,
};

const NOMINEE_DATA: Record<string, NomineeDataFile> = {
  akutagawa: akutagawaNominee,
  naoki: naokiNominee,
  'honya-taisho': honyaTaishoNominee,
  'yoshikawa-eiji': yoshikawaEijiNominee,
  'noma-bungei': nomaBungeiNominee,
  'tanizaki-junichiro': tanizakiJunichiroNominee,
  'edogawa-ranpo': edogawaRanpoNominee,
  kawabata: kawabataNominee,
};

export function loadPrizeData(slug: string): PrizeDataFile {
  const data = PRIZE_DATA[slug];
  if (!data) {
    throw new Error(`Prize data not found for award: ${slug}`);
  }
  return data;
}

export function loadNomineeData(slug: string): NomineeDataFile | null {
  return NOMINEE_DATA[slug] ?? null;
}

export function hasPrizeData(slug: string): boolean {
  return slug in PRIZE_DATA;
}
