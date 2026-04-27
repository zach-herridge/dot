import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Package } from './package.js';

/**
 * Build system detection for workspace packages.
 * Determines how to build, test, and run integration tests for each package.
 *
 * Primary detection: parse `build-system` from the Brazil Config file.
 * Fallback: check for build.gradle.kts / package.json (for test detection).
 */

export type BuildSystem = 'gradle' | 'npm' | 'brazil' | 'none';

export interface BuildInfo {
  system: BuildSystem;
  testCommand: string | null;
  integTestCommand: string | null;
  buildCommand: string;
  isIntegTestPackage: boolean;
}

/** Detect build system and test capabilities for a package. */
export function detect(pkg: Package): BuildInfo {
  const configBuildSystem = readBuildSystem(pkg.path);
  const gradlePath = join(pkg.path, 'build.gradle.kts');
  const pkgJsonPath = join(pkg.path, 'package.json');

  // Gradle packages (brazil-gradle)
  if (existsSync(gradlePath)) {
    return detectGradle(pkg, gradlePath);
  }

  // NPM packages (npm-pretty-much, cdk-build)
  if (existsSync(pkgJsonPath)) {
    return detectNpm(pkg, pkgJsonPath);
  }

  // Other Brazil build systems (happytrails, brazilmake, copy-public-docs, etc.)
  // These all build via `brazil-build` but don't have test infrastructure we know about.
  if (configBuildSystem && configBuildSystem !== 'no-op') {
    return {
      system: 'brazil',
      testCommand: null,
      integTestCommand: null,
      buildCommand: 'brazil-build',
      isIntegTestPackage: false,
    };
  }

  return {
    system: 'none',
    testCommand: null,
    integTestCommand: null,
    buildCommand: 'brazil-build',
    isIntegTestPackage: false,
  };
}

/** Read `build-system` value from a Brazil Config file. */
function readBuildSystem(pkgPath: string): string | null {
  try {
    const config = readFileSync(join(pkgPath, 'Config'), 'utf-8');
    const match = config.match(/build-system\s*=\s*([^;\s]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function detectGradle(pkg: Package, gradlePath: string): BuildInfo {
  const content = readFileSync(gradlePath, 'utf-8');
  const isInteg = pkg.name.toLowerCase().includes('integrationtests');
  const hasJUnit = content.includes('useJUnitPlatform');
  const hasIntegTask = content.includes('integTest');

  return {
    system: 'gradle',
    testCommand: hasJUnit && !isInteg ? 'brazil-build test' : null,
    integTestCommand: hasIntegTask || isInteg ? 'brazil-build integTest' : null,
    buildCommand: 'brazil-build',
    isIntegTestPackage: isInteg,
  };
}

function detectNpm(pkg: Package, pkgJsonPath: string): BuildInfo {
  let scripts: Record<string, string> = {};
  try {
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    scripts = pkgJson.scripts ?? {};
  } catch {
    // ignore parse errors
  }

  const isInteg = pkg.name.toLowerCase().includes('integrationtests');
  const testScript = scripts.test ?? '';
  const hasUnitTests =
    !!testScript &&
    !testScript.includes("echo 'No tests'") &&
    !testScript.includes('echo "No tests"') &&
    !testScript.includes('echo "Error: no test specified"');
  const hasIntegTests = !!scripts['test:integration'];

  return {
    system: 'npm',
    testCommand: hasUnitTests && !isInteg ? 'npm test' : null,
    integTestCommand: hasIntegTests ? 'npm run test:integration' : null,
    buildCommand: 'brazil-build',
    isIntegTestPackage: isInteg,
  };
}
