import { ClashRFTransaction } from '../../models/ClashRFTransaction';
import { ClashTeam } from '../../models/ClashTeam';

/**
 * Service that encapsulates all RF balance mutations. Always use
 * `add` to apply RF adjustments so that a ledger entry is
 * persisted and the team's cached rfBalance stays in sync. The
 * balance function returns the cached rfBalance, falling back on
 * zero if no team document exists.
 */
export const rfLedger = {
  /**
   * Append a new RF transaction and increment the team's balance.
   *
   * @param teamNumber Target team
   * @param delta The RF delta (positive or negative)
   * @param opts Additional metadata: eventId, type and optional actor/target/meta
   */
  async add(
    teamNumber: number,
    delta: number,
    opts: { eventId: string; type: string; actorId?: string; targetTeam?: number; meta?: any }
  ): Promise<void> {
    const { eventId, type, actorId, targetTeam, meta } = opts;
    await ClashRFTransaction.create({ eventId, teamNumber, type, delta, actorId, targetTeam, meta });
    await ClashTeam.updateOne({ eventId, teamNumber }, { $inc: { rfBalance: delta } }).exec();
  },

  /**
   * Return the cached RF balance for a team.
   */
  async balance(eventId: string, teamNumber: number): Promise<number> {
    const team = await ClashTeam.findOne({ eventId, teamNumber }).lean().exec();
    return team?.rfBalance ?? 0;
  },
};