/**
 * @module api/rpc
 */

import {Attestation, BeaconBlock, BLSPubkey, bytes96, Epoch, Shard, Slot, ValidatorDuty} from "@chainsafe/eth2.0-types";
import {IBeaconConfig} from "@chainsafe/eth2.0-config";

import {BeaconDb, IBeaconDb} from "../../../../db";
import {BeaconChain} from "../../../../chain";
import {OpPool} from "../../../../opPool";
import {IValidatorApi} from "./interface";
import {assembleBlock} from "../../../../chain/factory/block";
import {IEth1Notifier} from "../../../../eth1";
import {getValidatorDuties, produceAttestation} from "../../../impl/validator";
import {ApiNamespace} from "../../../index";
import {ILogger} from "../../../../logger";
import {processAttestation} from "../../../../chain/stateTransition/block/operations";

export class ValidatorApi implements IValidatorApi {

  public namespace: ApiNamespace;

  private config: IBeaconConfig;
  private chain: BeaconChain;
  private db: IBeaconDb;
  private opPool: OpPool;
  private eth1: IEth1Notifier;
  private logger: ILogger;

  public constructor(opts, {config, chain, db, opPool, eth1, logger}) {
    this.namespace = ApiNamespace.VALIDATOR;
    this.config = config;
    this.chain = chain;
    this.db = db;
    this.logger = logger;
    this.opPool = opPool;
    this.eth1 = eth1;
  }

  public async produceBlock(slot: Slot, randaoReveal: bytes96): Promise<BeaconBlock> {
    return await assembleBlock(this.config, this.db, this.opPool, this.eth1, slot, randaoReveal);
  }

  public async getDuties(validatorPublicKeys: BLSPubkey[], epoch: Epoch): Promise<ValidatorDuty[]> {
    return getValidatorDuties(this.config, this.db, validatorPublicKeys, epoch);
  }

  public async produceAttestation(validatorPubKey: BLSPubkey, pocBit: boolean, slot: Slot, shard: Shard): Promise<Attestation> {
    try {
      return await produceAttestation(
        {config: this.config, chain: this.chain, db: this.db},
        validatorPubKey,
        shard,
        slot
      );
    } catch (e) {
      this.logger.warn(`Failed to produce attestation because: ${e.message}`);
    }
  }

  public async publishBlock(block: BeaconBlock): Promise<void> {
    await this.chain.receiveBlock(block);
  }

  public async publishAttestation(attestation: Attestation): Promise<void> {
    const state = await this.db.state.getLatest();
    state.slot++;
    try {
      processAttestation(this.config, state, attestation);
      await this.opPool.attestations.receive(attestation);
    } catch (e) {
      this.logger.warn(`Received attestation is invalid. Reason: ${e.message}`);
      return null;
    }
  }

  public async getValidatorIndex(pubKey: BLSPubkey): Promise<number> {
    return this.db.getValidatorIndex(pubKey);
  }

}