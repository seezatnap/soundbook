/*
 * The lab registry — the catalogue the browser sidebar and URL decoder
 * both read. Order within a family is presentation order.
 */

import { withStage, type LabFamily, type StagedLab } from '@/sdk/lab';
import { oscillatorMicroscope } from '@/labs/oscillator-microscope';
import { makeStage as oscillatorMicroscopeStage } from '@/labs/oscillator-microscope/stage';
import { resonantMaterials } from '@/labs/resonant-materials';
import { makeStage as resonantMaterialsStage } from '@/labs/resonant-materials/stage';
import { euclideanConstellation } from '@/labs/euclidean-constellation';
import { makeStage as euclideanConstellationStage } from '@/labs/euclidean-constellation/stage';
import { polymeterLoom } from '@/labs/polymeter-loom';
import { makeStage as polymeterLoomStage } from '@/labs/polymeter-loom/stage';
import { roomThatDoesNotExist } from '@/labs/room-that-does-not-exist';
import { makeStage as roomThatDoesNotExistStage } from '@/labs/room-that-does-not-exist/stage';
import { shipOfTheseus } from '@/labs/ship-of-theseus';
import { makeStage as shipOfTheseusStage } from '@/labs/ship-of-theseus/stage';
import { concordance } from '@/labs/concordance';
import { makeStage as concordanceStage } from '@/labs/concordance/stage';
import { droneLab } from '@/labs/drone-lab';
import { makeStage as droneLabStage } from '@/labs/drone-lab/stage';

/* Each lab's definition (index.ts — what a code export bundles) joined to
   its workshop stage (stage.ts — never bundled). */
export const LABS: StagedLab[] = [
  withStage(oscillatorMicroscope, oscillatorMicroscopeStage),
  withStage(resonantMaterials, resonantMaterialsStage),
  withStage(euclideanConstellation, euclideanConstellationStage),
  withStage(polymeterLoom, polymeterLoomStage),
  withStage(roomThatDoesNotExist, roomThatDoesNotExistStage),
  withStage(shipOfTheseus, shipOfTheseusStage),
  withStage(concordance, concordanceStage),
  withStage(droneLab, droneLabStage),
];

export const FAMILY_LABELS: Record<LabFamily, string> = {
  dronelab: 'DroneLab',
  composition: 'Compositions',
  instrumentation: 'Instrumentation',
  pattern: 'Pattern & Harmony',
  space: 'Space',
  quixotic: 'Quixotic',
};

export function findLab(id: string): StagedLab | undefined {
  return LABS.find((lab) => lab.id === id);
}
