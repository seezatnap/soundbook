/*
 * The lab registry — the catalogue the browser sidebar and URL decoder
 * both read. Order within a family is presentation order.
 */

import type { LabDefinition, LabFamily } from '@/sdk/lab';
import { oscillatorMicroscope } from '@/labs/oscillator-microscope';
import { resonantMaterials } from '@/labs/resonant-materials';
import { euclideanConstellation } from '@/labs/euclidean-constellation';
import { polymeterLoom } from '@/labs/polymeter-loom';
import { roomThatDoesNotExist } from '@/labs/room-that-does-not-exist';
import { shipOfTheseus } from '@/labs/ship-of-theseus';
import { concordance } from '@/labs/concordance';
import { droneLab } from '@/labs/drone-lab';

export const LABS: LabDefinition[] = [
  oscillatorMicroscope,
  resonantMaterials,
  euclideanConstellation,
  polymeterLoom,
  roomThatDoesNotExist,
  shipOfTheseus,
  concordance,
  droneLab,
];

export const FAMILY_LABELS: Record<LabFamily, string> = {
  dronelab: 'DroneLab',
  composition: 'Compositions',
  instrumentation: 'Instrumentation',
  pattern: 'Pattern & Harmony',
  space: 'Space',
  quixotic: 'Quixotic',
};

export function findLab(id: string): LabDefinition | undefined {
  return LABS.find((lab) => lab.id === id);
}
