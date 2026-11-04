import type { SimDef } from '../core/types';
import { fish } from './fish';
import { ants } from './ants';
import { particleLife } from './particlelife';
import { fireflies } from './fireflies';
import { gravity } from './gravity';
import { pendulum } from './pendulum';
import { attractors } from './attractors';
import { magnetic } from './magnetic';
import { mycelium } from './mycelium';
import { physarum } from './physarum';
import { reaction } from './reaction';
import { life } from './life';
import { dla } from './dla';
import { sandpile } from './sandpile';
import { forestfire } from './forestfire';
import { ripple } from './ripple';
import { fluid } from './fluid';
import { cyclic } from './cyclic';
import { ising } from './ising';
import { ecosystem } from './ecosystem';
import { epidemic } from './epidemic';
import { traffic } from './traffic';

export const SIMS: SimDef[] = [
  fish, ants, particleLife, fireflies,
  gravity, pendulum, attractors, magnetic,
  mycelium, physarum, reaction, life, dla, sandpile, forestfire,
  ripple, fluid, cyclic, ising,
  ecosystem, epidemic, traffic,
];
