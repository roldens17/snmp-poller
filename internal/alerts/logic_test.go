package alerts

import "testing"

func TestThreeFailuresTriggersDown(t *testing.T) {
	st := StateInput{CurrentState: "UP", ConsecutiveFailures: 2, ConsecutiveSuccesses: 0, PollSuccess: false}
	out := ComputeTransition(st)
	if out.Transition != "down" || out.NextState != "DOWN" {
		t.Fatalf("expected down transition, got %+v", out)
	}
}

func TestAdditionalFailuresWhileDownNoNewTransition(t *testing.T) {
	st := StateInput{CurrentState: "DOWN", ConsecutiveFailures: 5, ConsecutiveSuccesses: 0, PollSuccess: false}
	out := ComputeTransition(st)
	if out.Transition != "none" || out.NextState != "DOWN" {
		t.Fatalf("expected no transition while down+failing, got %+v", out)
	}
}

func TestTwoSuccessesResolveDownToUp(t *testing.T) {
	st := StateInput{CurrentState: "DOWN", ConsecutiveFailures: 0, ConsecutiveSuccesses: 1, PollSuccess: true}
	out := ComputeTransition(st)
	if out.Transition != "up" || out.NextState != "UP" {
		t.Fatalf("expected up transition, got %+v", out)
	}
}

func TestFlapDoesNotTriggerUntil3ConsecutiveFails(t *testing.T) {
	st := StateInput{CurrentState: "UP", ConsecutiveFailures: 0, ConsecutiveSuccesses: 0, PollSuccess: false}
	out := ComputeTransition(st)
	if out.Transition != "none" || out.ConsecutiveFailures != 1 { t.Fatalf("step1 %+v", out) }
	st = StateInput{CurrentState: out.NextState, ConsecutiveFailures: out.ConsecutiveFailures, ConsecutiveSuccesses: out.ConsecutiveSuccesses, PollSuccess: true}
	out = ComputeTransition(st)
	if out.ConsecutiveFailures != 0 || out.ConsecutiveSuccesses != 1 { t.Fatalf("step2 %+v", out) }
	st = StateInput{CurrentState: out.NextState, ConsecutiveFailures: out.ConsecutiveFailures, ConsecutiveSuccesses: out.ConsecutiveSuccesses, PollSuccess: false}
	out = ComputeTransition(st)
	if out.Transition != "none" || out.ConsecutiveFailures != 1 { t.Fatalf("step3 %+v", out) }
}

func TestTenantIsolationEquivalentByIndependentState(t *testing.T) {
	// Tenant A and B identical device ids behave independently if state tracked separately.
	a := ComputeTransition(StateInput{CurrentState: "UP", ConsecutiveFailures: 2, PollSuccess: false})
	b := ComputeTransition(StateInput{CurrentState: "UP", ConsecutiveFailures: 0, PollSuccess: false})
	if a.Transition != "down" { t.Fatalf("tenant A expected down") }
	if b.Transition == "down" { t.Fatalf("tenant B should not be down") }
}

// TestComputeTransition covers all state/threshold edge cases with a table-driven approach.
// Note: thresholds are hardcoded (≥3 failures → DOWN, ≥2 successes → UP). The FailThreshold
// and ClearThreshold fields on PollResult are stored as metadata only and do not affect this function.
func TestComputeTransition(t *testing.T) {
	tests := []struct {
		name             string
		in               StateInput
		wantTransition   string
		wantNextState    string
		wantFailures     int
		wantSuccesses    int
	}{
		{
			name:           "success while UP resets failure counter",
			in:             StateInput{CurrentState: "UP", ConsecutiveFailures: 2, ConsecutiveSuccesses: 0, PollSuccess: true},
			wantTransition: "none",
			wantNextState:  "UP",
			wantFailures:   0,
			wantSuccesses:  1,
		},
		{
			name:           "1 failure from UP stays UP",
			in:             StateInput{CurrentState: "UP", ConsecutiveFailures: 0, ConsecutiveSuccesses: 0, PollSuccess: false},
			wantTransition: "none",
			wantNextState:  "UP",
			wantFailures:   1,
			wantSuccesses:  0,
		},
		{
			name:           "2 failures from UP stays UP (one below threshold)",
			in:             StateInput{CurrentState: "UP", ConsecutiveFailures: 1, ConsecutiveSuccesses: 0, PollSuccess: false},
			wantTransition: "none",
			wantNextState:  "UP",
			wantFailures:   2,
			wantSuccesses:  0,
		},
		{
			name:           "exact threshold: 3rd failure triggers DOWN",
			in:             StateInput{CurrentState: "UP", ConsecutiveFailures: 2, ConsecutiveSuccesses: 0, PollSuccess: false},
			wantTransition: "down",
			wantNextState:  "DOWN",
			wantFailures:   3,
			wantSuccesses:  0,
		},
		{
			name:           "UNKNOWN + 3 failures triggers DOWN",
			in:             StateInput{CurrentState: "UNKNOWN", ConsecutiveFailures: 2, ConsecutiveSuccesses: 0, PollSuccess: false},
			wantTransition: "down",
			wantNextState:  "DOWN",
			wantFailures:   3,
			wantSuccesses:  0,
		},
		{
			name:           "UNKNOWN + success stays UNKNOWN",
			in:             StateInput{CurrentState: "UNKNOWN", ConsecutiveFailures: 0, ConsecutiveSuccesses: 0, PollSuccess: true},
			wantTransition: "none",
			wantNextState:  "UNKNOWN",
			wantFailures:   0,
			wantSuccesses:  1,
		},
		{
			name:           "DOWN + 1 success stays DOWN (one below clear threshold)",
			in:             StateInput{CurrentState: "DOWN", ConsecutiveFailures: 3, ConsecutiveSuccesses: 0, PollSuccess: true},
			wantTransition: "none",
			wantNextState:  "DOWN",
			wantFailures:   0,
			wantSuccesses:  1,
		},
		{
			name:           "DOWN + failure stays DOWN, failure counter increments",
			in:             StateInput{CurrentState: "DOWN", ConsecutiveFailures: 5, ConsecutiveSuccesses: 0, PollSuccess: false},
			wantTransition: "none",
			wantNextState:  "DOWN",
			wantFailures:   6,
			wantSuccesses:  0,
		},
		{
			name:           "failure resets success counter",
			in:             StateInput{CurrentState: "DOWN", ConsecutiveFailures: 0, ConsecutiveSuccesses: 1, PollSuccess: false},
			wantTransition: "none",
			wantNextState:  "DOWN",
			wantFailures:   1,
			wantSuccesses:  0,
		},
		{
			name:           "success resets failure counter on any state",
			in:             StateInput{CurrentState: "UP", ConsecutiveFailures: 1, ConsecutiveSuccesses: 0, PollSuccess: true},
			wantTransition: "none",
			wantNextState:  "UP",
			wantFailures:   0,
			wantSuccesses:  1,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			out := ComputeTransition(tc.in)
			if out.Transition != tc.wantTransition {
				t.Errorf("Transition: got %q, want %q", out.Transition, tc.wantTransition)
			}
			if out.NextState != tc.wantNextState {
				t.Errorf("NextState: got %q, want %q", out.NextState, tc.wantNextState)
			}
			if out.ConsecutiveFailures != tc.wantFailures {
				t.Errorf("ConsecutiveFailures: got %d, want %d", out.ConsecutiveFailures, tc.wantFailures)
			}
			if out.ConsecutiveSuccesses != tc.wantSuccesses {
				t.Errorf("ConsecutiveSuccesses: got %d, want %d", out.ConsecutiveSuccesses, tc.wantSuccesses)
			}
		})
	}
}
