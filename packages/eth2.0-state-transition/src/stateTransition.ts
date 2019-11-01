import { expose, spawn, Thread, Worker } from "threads";
import {stateTransition} from "./index";


expose(stateTransition)

