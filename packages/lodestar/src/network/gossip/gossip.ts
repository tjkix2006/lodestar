/* eslint-disable @typescript-eslint/member-ordering */
/**
 * @module network/gossip
 */

import {EventEmitter} from "events";
//@ts-ignore
import promisify from "promisify-es6";
import LibP2p from "libp2p";
//@ts-ignore
import Gossipsub from "libp2p-gossipsub";
import {IBeaconConfig} from "@chainsafe/eth2.0-config";
import {ATTESTATION_SUBNET_COUNT} from "../../constants";
import {ILogger, LogLevel} from "../../logger";
import {getGossipTopic,} from "./utils";
import {INetworkOptions} from "../options";
import {GossipEventEmitter, IGossip, IGossipEvents, IGossipModules,} from "./interface";
import {GossipEvent} from "./constants";
import {handleIncomingBlock, publishBlock} from "./handlers/block";
import {handleIncomingAttestation, publishCommiteeAttestation, getCommitteeAttestationHandler} from "./handlers/attestation";
import {handleIncomingAttesterSlashing, publishAttesterSlashing} from "./handlers/attesterSlashing";
import {handleIncomingProposerSlashing, publishProposerSlashing} from "./handlers/proposerSlashing";
import {handleIncomingVoluntaryExit, publishVoluntaryExit} from "./handlers/voluntaryExit";
import {handleIncomingAggregateAndProof, publishAggregatedAttestation} from "./handlers/aggregateAndProof";

export class Gossip extends (EventEmitter as { new(): GossipEventEmitter }) implements IGossip {

  protected readonly  opts: INetworkOptions;
  protected readonly config: IBeaconConfig;
  protected readonly  libp2p: LibP2p;
  protected readonly  pubsub: Gossipsub;
  protected readonly  logger: ILogger;

  private handlers: Map<string, Function>;

  public constructor(opts: INetworkOptions, {config, libp2p, logger}: IGossipModules) {
    super();
    this.opts = opts;
    this.config = config;
    this.libp2p = libp2p;
    this.logger = logger.child({module: "gossip", level: LogLevel[logger.level]});
    this.logger.silent = logger.silent;
    this.pubsub = new Gossipsub(libp2p, {gossipIncoming: false});
    this.handlers = this.registerHandlers();
  }

  public async start(): Promise<void> {
    await promisify(this.pubsub.start.bind(this.pubsub))();
    this.handlers.forEach((handler, topic) => {
      this.pubsub.on(topic, handler);
    });
  }

  public async stop(): Promise<void> {
    await promisify(this.pubsub.stop.bind(this.pubsub))();
    this.handlers.forEach((handler, topic) => {
      this.pubsub.removeListener(topic, handler);
    });
  }

  public publishBlock = publishBlock;

  public publishCommiteeAttestation = publishCommiteeAttestation;

  public publishAggregatedAttestation = publishAggregatedAttestation;

  public publishVoluntaryExit = publishVoluntaryExit;

  public publishProposerSlashing = publishProposerSlashing;

  public publishAttesterSlashing = publishAttesterSlashing;

  // @ts-ignore
  public on(event: keyof IGossipEvents, listener: Function): void {
    if(this.listenerCount(event) === 0 && !event.startsWith("gossipsub")) {
      this.pubsub.subscribe(getGossipTopic(event as GossipEvent, "ssz"));
    }
    // @ts-ignore
    super.on(event, listener);
  }

  // @ts-ignore
  public once(event: keyof IGossipEvents, listener: Function): void {
    if(this.listenerCount(event) === 0 && !event.startsWith("gossipsub")) {
      this.pubsub.subscribe(getGossipTopic(event as GossipEvent, "ssz"));
    }
    // @ts-ignore
    super.once(event, (args: unknown[]) => {
      this.pubsub.unsubscribe(getGossipTopic(event as GossipEvent, "ssz"));
      listener(args);
    });
  }

  // @ts-ignore
  public removeListener(event: keyof IGossipEvents, listener: Function): void {
    // @ts-ignore
    super.on(event, listener);
    if(this.listenerCount(event) === 0 && !event.startsWith("gossipsub")) {
      this.pubsub.unsubscribe(getGossipTopic(event as GossipEvent, "ssz"));
    }
  }

  // @ts-ignore
  public removeAllListeners(event: keyof IGossipEvents): void {
    // @ts-ignore
    super.removeAllListeners(event);
    if(!event.startsWith("gossipsub")) {
      this.pubsub.unsubscribe(getGossipTopic(event as GossipEvent, "ssz"));
    }
  }

  private registerHandlers(): Map<string, Function> {
    const handlers = new Map();
    handlers.set("gossipsub:heartbeat", this.emitGossipHeartbeat);
    handlers.set(getGossipTopic(GossipEvent.BLOCK, "ssz"), handleIncomingBlock.bind(this));
    handlers.set(getGossipTopic(GossipEvent.ATTESTATION, "ssz"), handleIncomingAttestation.bind(this));
    handlers.set(getGossipTopic(GossipEvent.AGGREGATE_AND_PROOF, "ssz"), handleIncomingAggregateAndProof.bind(this));
    handlers.set(getGossipTopic(GossipEvent.ATTESTER_SLASHING, "ssz"), handleIncomingAttesterSlashing.bind(this));
    handlers.set(getGossipTopic(GossipEvent.PROPOSER_SLASHING, "ssz"), handleIncomingProposerSlashing.bind(this));
    handlers.set(getGossipTopic(GossipEvent.VOLUNTARY_EXIT, "ssz"), handleIncomingVoluntaryExit.bind(this));

    for(let subnet = 0; subnet < ATTESTATION_SUBNET_COUNT; subnet++) {
      const committeeAttestationHandler = getCommitteeAttestationHandler(subnet);
      handlers.set(
        getGossipTopic(
          GossipEvent.ATTESTATION_SUBNET,
          "ssz",
          new Map([["subnet", String(subnet)]])
        ),
        committeeAttestationHandler.bind(this)
      );
    }
    return handlers;
  }


  private emitGossipHeartbeat = (): void => {
    this.emit("gossipsub:heartbeat");
  };

}
