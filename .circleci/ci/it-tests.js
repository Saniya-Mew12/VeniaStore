/*******************************************************************************
 *
 *    Copyright 2019 Adobe. All rights reserved.
 *    This file is licensed to you under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License. You may obtain a copy
 *    of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software distributed under
 *    the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 *    OF ANY KIND, either express or implied. See the License for the specific language
 *    governing permissions and limitations under the License.
 *
 ******************************************************************************/

'use strict';

const ci = new (require('./ci.js'))();
ci.context();
const qpPath = '/home/circleci/cq';
const { TYPE, BROWSER } = process.env;

try {
    ci.stage("Integration Tests");
    let veniaVersion = ci.sh('mvn help:evaluate -Dexpression=project.version -q -DforceStdout', true);
    let cifVersion = ci.sh('mvn help:evaluate -Dexpression=core.cif.components.version -q -DforceStdout', true);
    let wcmVersion = ci.sh('mvn help:evaluate -Dexpression=core.wcm.components.version -q -DforceStdout', true);
    let connectorVersion = '1.8.0-magento242ee';
    let graphqlClientVersion = ci.sh('mvn help:evaluate -Dexpression=graphql.client.version -q -DforceStdout', true);
    let classifier = process.env.AEM;

    ci.dir(qpPath, () => {
        // Connect to QP
        ci.sh('./qp.sh -v bind --server-hostname localhost --server-port 55555');
        
        // We install the graphql-client by default except with the CIF Add-On
        let extras = `--bundle com.adobe.commerce.cif:graphql-client:${graphqlClientVersion}:jar`;
        if (classifier == 'classic') {
            // Install CIF connector
            extras += ` --bundle com.adobe.commerce.cif:cif-connector-all:${connectorVersion}:zip`;

            // The core components are already installed in the Cloud SDK
            extras += ` --bundle com.adobe.cq:core.wcm.components.all:${wcmVersion}:zip`;

        } else if (classifier == 'cloud') {
            // Get CIF add-on for cloud SDK. Use the following version keywords:
            // LATEST: latest snapshot version
            // LATEST-RELEASE: latest release version
            extras = '--bundle com.adobe.cq.cif:cif-cloud-ready-feature-pkg:LATEST-RELEASE:far:cq-commerce-addon-authorfar'
        }

        // Install SNAPSHOT or current version of CIF examples bundle
        if (cifVersion.endsWith('-SNAPSHOT')) {
            let jar = `core-cif-components-examples-bundle-${cifVersion}.jar`;
            extras += ` --install-file /home/circleci/build/dependencies/aem-core-cif-components/examples/bundle/target/${jar}`;
        } else {
            extras += ` --bundle com.adobe.commerce.cif:core-cif-components-examples-bundle:${cifVersion}:jar`;
        }

        // Start CQ
        ci.sh(`./qp.sh -v start --id author --runmode author --port 4502 --qs-jar /home/circleci/cq/author/cq-quickstart.jar \
            --bundle org.apache.sling:org.apache.sling.junit.core:1.0.23:jar \
            ${extras} \
            --install-file /home/circleci/build/all/target/venia.all-${veniaVersion}-${classifier}.zip \
            --vm-options \\\"-Xmx1536m -XX:MaxPermSize=256m -Djava.awt.headless=true -Dorg.apache.maven.user-settings=/home/circleci/build/.circleci/settings.xml -javaagent:${process.env.JACOCO_AGENT}=destfile=crx-quickstart/jacoco-it.exec\\\"`);
    });

    // Run integration tests
    if (TYPE === 'integration') {
        ci.dir('it.tests', () => {
            ci.sh(`mvn clean verify -U -B -Plocal,${classifier}`); // The -Plocal profile comes from the AEM archetype 
        });
    }
    if (TYPE === 'selenium') {
        // Get version of ChromeDriver
        let chromedriver = ci.sh('chromedriver --version', true); // Returns something like ChromeDriver 80.0.3987.16 (320f6526c1632ad4f205ebce69b99a062ed78647-refs/branch-heads/3987@{#185})
        chromedriver = chromedriver.split(' ');
        chromedriver = chromedriver.length >= 2 ? chromedriver[1] : '';

        ci.dir('ui.tests', () => {
            ci.sh(`CHROMEDRIVER=${chromedriver} mvn test -U -B -Pui-tests-local-execution -DHEADLESS_BROWSER=true -DSELENIUM-BROWSER=${BROWSER}`);
        });
    }
    
    ci.dir(qpPath, () => {
        // Stop CQ
        ci.sh('./qp.sh -v stop --id author');
    });

} finally { 
    // Copy tests results
    ci.sh('mkdir test-reports');
    if (TYPE === 'integration') {
        ci.sh('cp -r it.tests/target/failsafe-reports test-reports/it.tests');
    }
    if (TYPE === 'selenium') {
        ci.sh('cp -r ui.tests/test-module/reports test-reports/ui.tests');
    }
    
    // Always download logs from AEM container
    ci.sh('mkdir logs');
    ci.dir('logs', () => {
        // A webserver running inside the AEM container exposes the logs folder, so we can download log files as needed.
        ci.sh('curl -O -f http://localhost:3000/crx-quickstart/logs/error.log');
        ci.sh('curl -O -f http://localhost:3000/crx-quickstart/logs/stdout.log');
        ci.sh('curl -O -f http://localhost:3000/crx-quickstart/logs/stderr.log');
        ci.sh(`find . -name '*.log' -type f -size +32M -exec echo 'Truncating: ' {} \\; -execdir truncate --size 32M {} +`);
    });
}