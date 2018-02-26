/*
 * Copyright © 2017 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 *
 * @flow
 *
 */
import naclFactory from 'js-nacl';
import api from './api/liskApi';
import cryptography from './cryptography';
import passphrase from './passphrase';
import * as time from './transactions/utils/time';
import transaction from './transactions';

declare var global: {
	naclInstance: ?NaclInstance,
	naclFactory: any,
}

global.naclFactory = naclFactory;
global.naclInstance = null;

naclFactory.instantiate(nacl => {
	naclInstance = nacl;
});

export default { cryptography, transaction, api, time, passphrase };
