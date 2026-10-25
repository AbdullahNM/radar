package config

import (
	"flag"
	"io"
	"strings"
	"testing"
)

func TestPprofOverride(t *testing.T) {
	for _, tt := range []struct {
		name string
		env  string
		args []string
		want string
	}{
		{name: "automatic", want: "auto"},
		{name: "flag on", args: []string{"--pprof"}, want: "true"},
		{name: "flag off", args: []string{"--pprof=false"}, want: "false"},
		{name: "env on", env: "1", want: "true"},
		{name: "env off", env: "0", want: "false"},
		{name: "env mixed case", env: "True", want: "true"},
		{name: "flag overrides env on", env: "true", args: []string{"--pprof=false"}, want: "false"},
		{name: "flag overrides env off", env: "false", args: []string{"--pprof"}, want: "true"},
		{name: "invalid env", env: "yes", want: "error"},
		{name: "flag overrides invalid env", env: "yes", args: []string{"--pprof=false"}, want: "false"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("RADAR_PPROF", tt.env)
			fs := flag.NewFlagSet("test", flag.ContinueOnError)
			fs.SetOutput(io.Discard)
			flags := RegisterPprofFlags(fs)
			if err := fs.Parse(tt.args); err != nil {
				t.Fatal(err)
			}
			got, err := flags.Resolve()
			if tt.want == "error" {
				if err == nil || !strings.Contains(err.Error(), "RADAR_PPROF must be a boolean") {
					t.Fatalf("expected invalid environment error, got %v", err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if tt.want == "auto" {
				if got != nil {
					t.Fatalf("expected automatic default, got %v", *got)
				}
			} else if got == nil || *got != (tt.want == "true") {
				t.Fatalf("override = %v, want %s", got, tt.want)
			}
		})
	}
}
