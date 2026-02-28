package alerts

type StateInput struct {
	CurrentState          string
	ConsecutiveFailures   int
	ConsecutiveSuccesses  int
	PollSuccess           bool
}

type StateOutput struct {
	NextState             string
	ConsecutiveFailures   int
	ConsecutiveSuccesses  int
	Transition            string // none|down|up
}

func ComputeTransition(in StateInput) StateOutput {
	failures := in.ConsecutiveFailures
	successes := in.ConsecutiveSuccesses
	if in.PollSuccess {
		successes++
		failures = 0
	} else {
		failures++
		successes = 0
	}
	out := StateOutput{NextState: in.CurrentState, ConsecutiveFailures: failures, ConsecutiveSuccesses: successes, Transition: "none"}
	if in.CurrentState != "DOWN" && failures >= 3 {
		out.NextState = "DOWN"
		out.Transition = "down"
		return out
	}
	if in.CurrentState == "DOWN" && successes >= 2 {
		out.NextState = "UP"
		out.Transition = "up"
	}
	return out
}
