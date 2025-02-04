import {BeaconBlock} from "@chainsafe/eth2.0-types";
import {IBeaconConfig} from "@chainsafe/eth2.0-config";
import {BulkRepository} from "../repository";
import {IDatabaseController} from "../../../controller";
import {Bucket, encodeKey} from "../../../schema";
import {serialize} from "@chainsafe/ssz";

/**
 * Stores finalized blocks. Block slot is identifier.
 */
export class BlockArchiveRepository extends BulkRepository<BeaconBlock> {

  public constructor(
    config: IBeaconConfig,
    db: IDatabaseController
  ) {
    super(config, db, Bucket.blockArchive, config.types.BeaconBlock);
  }

  public async addMany(blocks: BeaconBlock[]): Promise<void> {
    await this.db.batchPut(
      blocks.map((block) => ({
        key: encodeKey(this.bucket, block.slot),
        value: serialize(this.type, block)
      }))
    );
  }

  public async add(value: BeaconBlock): Promise<void> {
    return this.set(value.slot, value);
  }
}
