package config

import (
	"flag"
	"fmt"
	"os"
	"strconv"
)

type PprofFlags struct {
	fs      *flag.FlagSet
	enabled *bool
}

func RegisterPprofFlags(fs *flag.FlagSet) PprofFlags {
	return PprofFlags{
		fs:      fs,
		enabled: fs.Bool("pprof", false, "Override pprof profiling at /debug/pprof: defaults on for loopback or authenticated listeners, off for unauthenticated shared listeners; always off in Cloud mode (env: RADAR_PPROF)"),
	}
}

// A nil override preserves the listener/authentication-based server default.
func (f PprofFlags) Resolve() (*bool, error) {
	var explicit *bool
	f.fs.Visit(func(v *flag.Flag) {
		if v.Name == "pprof" {
			explicit = f.enabled
		}
	})
	if explicit != nil {
		return explicit, nil
	}
	if raw := os.Getenv("RADAR_PPROF"); raw != "" {
		enabled, err := strconv.ParseBool(raw)
		if err != nil {
			return nil, fmt.Errorf("RADAR_PPROF must be a boolean: %w", err)
		}
		return &enabled, nil
	}
	return nil, nil
}
