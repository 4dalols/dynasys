import type { SimDef } from '../core/types';
import { fish } from './fish';
import { murmuration } from './murmuration';
import { ants } from './ants';
import { antwars } from './antwars';
import { particleLife } from './particlelife';
import { fireflies } from './fireflies';
import { rps } from './rps';
import { gravity } from './gravity';
import { gas } from './gas';
import { cloth } from './cloth';
import { charges } from './charges';
import { pendulum } from './pendulum';
import { attractors } from './attractors';
import { clifford } from './clifford';
import { logistic } from './logistic';
import { magnetic } from './magnetic';
import { mycelium } from './mycelium';
import { physarum } from './physarum';
import { reaction } from './reaction';
import { lenia } from './lenia';
import { life } from './life';
import { turmites } from './turmites';
import { dla } from './dla';
import { sandpile } from './sandpile';
import { forestfire } from './forestfire';
import { sand } from './sand';
import { ripple } from './ripple';
import { fluid } from './fluid';
import { cyclic } from './cyclic';
import { ising } from './ising';
import { ecosystem } from './ecosystem';
import { epidemic } from './epidemic';
import { traffic } from './traffic';
import { prisoners } from './prisoners';
import { schelling } from './schelling';
import { battlefield } from './battlefield';
import { empires } from './empires';
import { alliances } from './alliances';

export const SIMS: SimDef[] = [
  fish, murmuration, ants, antwars, particleLife, fireflies, rps,
  gravity, gas, cloth, charges,
  pendulum, attractors, clifford, logistic, magnetic,
  mycelium, physarum, reaction, lenia, life, turmites, dla, sandpile, forestfire,
  sand, ripple, fluid, cyclic, ising,
  ecosystem, epidemic, traffic, prisoners, schelling, battlefield, empires, alliances,
];
