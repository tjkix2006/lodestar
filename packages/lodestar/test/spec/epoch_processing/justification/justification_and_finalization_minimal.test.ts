import {join} from "path";
import {expect} from "chai";
import {equals} from "@chainsafe/ssz";

import {config} from "@chainsafe/eth2.0-config/lib/presets/minimal";
import {processJustificationAndFinalization} from "@chainsafe/eth2.0-state-transition";
import {BeaconState} from "@chainsafe/eth2.0-types";
import {describeDirectorySpecTest, InputType} from "@chainsafe/eth2.0-spec-test-util/lib/single";
import {StateTestCase} from "../../../utils/specTestTypes/stateTestCase";
import {SPEC_TEST_LOCATION} from "../../../utils/specTestCases";

describeDirectorySpecTest<StateTestCase, BeaconState>(
  "epoch justification and finalization minimal",
  join(SPEC_TEST_LOCATION, "/tests/minimal/phase0/epoch_processing/justification_and_finalization/pyspec_tests"),
  (testcase) => {
    const state = testcase.pre;
    processJustificationAndFinalization(config, state);
    return state;
  },
  {
    inputTypes: {
      pre: InputType.SSZ,
      post: InputType.SSZ,
    },
    sszTypes: {
      pre: config.types.BeaconState,
      post: config.types.BeaconState,
    },
    getExpected: (testCase => testCase.post),
    expectFunc: (testCase, expected, actual) => {
      expect(equals(config.types.BeaconState, actual, expected)).to.be.true;
    }
  }
);

