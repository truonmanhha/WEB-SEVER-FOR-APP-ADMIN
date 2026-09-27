import {productionStore} from '../lib/store.mjs';
import {databaseFromEnvironment} from '../lib/config.mjs';
const store=productionStore(databaseFromEnvironment(process.env));try{await store.migrate();console.log('Đã tạo/cập nhật bảng; không xóa dữ liệu cũ.');}finally{await store.pool.end();}

