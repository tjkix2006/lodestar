import sinon from "sinon";
import {describe} from "mocha";
import {expect} from "chai";
import {OpPool} from "../../../src/opPool";
import {generateEmptyBlock} from "../../utils/block";
import {EthersEth1Notifier} from "../../../src/eth1";
import {config} from "@chainsafe/eth2.0-config/lib/presets/mainnet";
import {
  AttesterSlashingRepository,
  DepositRepository,
  ProposerSlashingRepository, TransfersRepository,
  VoluntaryExitRepository, AttestationRepository,
  StateRepository
} from "../../../src/db/api/beacon/repositories";
import { generateState } from "../../utils/state";
import { generateValidators } from "../../utils/validator";

describe("operation pool", function () {
  let sandbox = sinon.createSandbox();
  let opPool: OpPool;
  let eth1Stub, dbStub;

  beforeEach(()=>{
    // @ts-ignore
    dbStub = {
      deposit: sandbox.createStubInstance(DepositRepository),
      voluntaryExit: sandbox.createStubInstance(VoluntaryExitRepository),
      proposerSlashing: sandbox.createStubInstance(ProposerSlashingRepository),
      attesterSlashing: sandbox.createStubInstance(AttesterSlashingRepository),
      transfer: sandbox.createStubInstance(TransfersRepository),
      // @ts-ignore
      attestation: sandbox.createStubInstance(AttestationRepository),
      state: sandbox.createStubInstance(StateRepository)
    };

    eth1Stub = sandbox.createStubInstance(EthersEth1Notifier);

    // Add to state
    dbStub.state.getLatest.resolves(generateState(
      {
        validators: generateValidators(100, {activation: 0, balance: 2n ** 5n * BigInt(1e9)})
      }
    ));

    opPool = new OpPool({}, {
      config: config,
      db: dbStub,
      eth1: eth1Stub
    });
  });

  //receive
  it('should start and stop operation pool ', async function () {
    try {
      await opPool.start();
      await opPool.stop();
    }catch (e) {
      expect.fail(e.stack);
    }
  });

  it('should do cleanup after block processing', async function () {
    const block  = generateEmptyBlock();
    dbStub.deposit.deleteOld.resolves();
    dbStub.voluntaryExit.deleteManyByValue.resolves();
    dbStub.transfer.deleteManyByValue.resolves();
    dbStub.proposerSlashing.deleteManyByValue.resolves();
    dbStub.attesterSlashing.deleteManyByValue.resolves();
    await opPool.processBlockOperations(block);
    expect(dbStub.deposit.deleteOld.calledOnce).to.be.true;
    expect(dbStub.voluntaryExit.deleteManyByValue.calledOnce).to.be.true;
    expect(dbStub.proposerSlashing.deleteManyByValue.calledOnce).to.be.true;
    expect(dbStub.transfer.deleteManyByValue.calledOnce).to.be.true;
    expect(dbStub.attesterSlashing.deleteManyByValue.calledOnce).to.be.true;
  });


});
