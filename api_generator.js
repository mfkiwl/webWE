let elem_input = document.getElementById('data_input');
let elem_output = document.getElementById('data_output');
let elem_error = document.getElementById('elem_error');

function isValidJson(json) {
    try {
        JSON.parse(json);
        return true;
    } catch (e) {
        return false;
    }
}

function textAreaAdjust(element) {
    element.style.height = "1px";
    element.style.height = (25+element.scrollHeight)+"px";
}

function clearApiImplementation(){
    elem_output.value = '';
}

function generateApiImplementation(){
    clearApiImplementation();
    elem_error.innerHTML = '<br>';
    
    if(isValidJson(elem_input.value)){
        let md = JSON.parse(elem_input.value);
        if(checkMetadataFormat(md)){
            elem_output.value = generateCodeFromMetadata(md);
            textAreaAdjust(elem_output);
        }
    } else {
        elem_error.innerHTML += '<h3>Invalid JSON format of inserted metadata</h3>';
    }
}

// ====================================================================================================
// Metadata Validation
// ====================================================================================================

function insertEmptyTemplateMetadata(){
    let client = new XMLHttpRequest();
    client.open('GET', '/empty_md.json');
    client.onreadystatechange = function() {
        elem_input.value = client.responseText;
        generateApiImplementation();
    }
    client.send();
}

function checkMetadataItem(md, key, obj_name, check_nonempty=false){
    if(!(key in md)){
        elem_error.innerHTML += '<h3>' + obj_name + ' is missing key \'' + key + '\'.</h3>';
        return false;
    }
    if(check_nonempty && (md[key] === '' || md[key] === null)){
        elem_error.innerHTML += '<h3>' + obj_name + ' key \'' + key + '\' cannot be empty.</h3>';
        return false;
    }
    return true;
}

function checkMetadataSubItem(obj, keys, obj_name, check_nonempty=false){
    let retval = true;
    keys.forEach(k => {
        if(!checkMetadataItem(obj, k, obj_name + ' item', check_nonempty)){retval = false;}
    })
    return retval;
}

function checkMetadataFormat(md){
    // temporary basic validation
    let keys = [
        'Name',
        'ID',
        'Inputs',
        'Outputs',
        'Execution_settings'
    ]
    let retval = true;
    keys.forEach(k => {
        if(!checkMetadataItem(md, k, 'Metadata JSON')){retval = false;}
    })
    
    if(!retval){return false;}
    
    for(let i=0;i<md["Inputs"].length;i++){
        if(!checkMetadataSubItem(md["Inputs"][i], ['Name', 'Type_ID', 'Type', 'Required', 'Set_at'], 'Inputs')){retval = false;}
    }
    for(let i=0;i<md["Outputs"].length;i++){
        if(!checkMetadataSubItem(md["Outputs"][i], ['Name', 'Type_ID', 'Type'], 'Outputs')){retval = false;}
    }
    if(!checkMetadataSubItem(md["Execution_settings"], ['Type', 'Class', 'Module', 'jobManName'], 'Execution_settings', true)){retval = false;}
    
    return retval;
}

// ====================================================================================================
// Code Generation
// ====================================================================================================

function generateCodeFromMetadata(md){
    let md_str = "MD = " + JSON.stringify(md, null, 4);
    md_str = md_str.replaceAll('false', 'False');
    md_str = md_str.replaceAll('true', 'True');
    let md_lines = md_str.split('\n');
    md_lines = push_indents_before_each_line(md_lines, 2);

    let inputs = md['Inputs'];
    let outputs = md['Outputs'];
    let obj_id;

    let code = [];
    code.push("import mupif");
    code.push("import Pyro5");
    code.push("");
    code.push("");

    code.push("@Pyro5.api.expose");
    code.push("class " + md['Execution_settings']['Class'] + "(mupif.Model):");

    code.push("\tdef __init__(self, metadata=None):");
    code.push("\t\t");
    extend_array(code, md_lines);
    code.push("");
    code.push("\t\tsuper().__init__(metadata=MD)");
    code.push("\t\tself.updateMetadata(metadata)");
    code.push("");

    code.push("\tdef initialize(self, workdir='', metadata=None, validateMetaData=True, **kwargs):");
    code.push("\t\tsuper().initialize(workdir=workdir, metadata=metadata, validateMetaData=validateMetaData, **kwargs)");
    code.push("");

    code.push("\tdef get(self, objectTypeID, time=None, objectID=\"\"):");
    if(outputs.length) {
        for (let i = 0; i < outputs.length; i++) {
            obj_id = null;
            if ('Obj_ID' in outputs[i]) {
                obj_id = outputs[i]['Obj_ID'];
            }
            if (obj_id === null) {
                code.push("\t\tif objectTypeID == " + outputs[i]['Type_ID'] + ":");
                code.push("\t\t\traise NotImplementedError(\"Not implemented\")");
            } else if (typeof obj_id == 'string') {
                code.push("\t\tif objectTypeID == " + outputs[i]['Type_ID'] + " and objectID == \"" + obj_id + "\":");
                code.push("\t\t\traise NotImplementedError(\"Not implemented\")");
            } else if (obj_id.constructor.name === "Array") {
                for (let ii = 0; ii < obj_id.length; ii++) {
                    code.push("\t\tif objectTypeID == " + outputs[i]['Type_ID'] + " and objectID == \"" + obj_id[ii] + "\":");
                    code.push("\t\t\traise NotImplementedError(\"Not implemented\")");
                }
            }
        }
    } else {
        code.push("\t\tpass");
    }
    code.push("");

    code.push("\tdef set(self, obj, objectID=\"\"):");
    if(inputs.length) {
        for (let i = 0; i < inputs.length; i++) {
            obj_id = null;
            if ('Obj_ID' in inputs[i]) {
                obj_id = inputs[i]['Obj_ID'];
            }
            if (obj_id === null) {
                code.push("\t\tif obj.isInstance(" + inputs[i]['Type'] + ") and obj.getDataID() == " + inputs[i]['Type_ID'] + ":");
                code.push("\t\t\traise NotImplementedError(\"Not implemented\")");
            } else if (typeof obj_id == 'string') {
                code.push("\t\tif obj.isInstance(" + inputs[i]['Type'] + ") and obj.getDataID() == " + inputs[i]['Type_ID'] + " and objectID == \"" + obj_id + "\":");
                code.push("\t\t\traise NotImplementedError(\"Not implemented\")");
            } else if (obj_id.constructor.name === "Array") {
                for (let ii = 0; ii < obj_id.length; ii++) {
                    code.push("\t\tif obj.isInstance(" + inputs[i]['Type'] + ") and obj.getDataID() == " + inputs[i]['Type_ID'] + " and objectID == \"" + obj_id[ii] + "\":");
                    code.push("\t\t\traise NotImplementedError(\"Not implemented\")");
                }
            }
        }
    } else {
        code.push("\t\tpass");
    }
    code.push("");

    code.push("\tdef solveStep(self, tstep, stageID=0, runInBackground=False):");
    code.push("\t\traise NotImplementedError(\"Not implemented\")");
    code.push("");
    
    if(md['Execution_settings']['Type'] === 'Distributed') {
        code.push("");
        code.push("if __name__ == '__main__':");
        code.push("\tns = mupif.pyroutil.connectNameserver()");
        code.push("\tjobMan = mupif.SimpleJobManager(");
        code.push("\t\tns=ns,");
        code.push("\t\tappClass=" + md['Execution_settings']['Class'] + ",");
        code.push("\t\tappName='" + md['Execution_settings']['jobManName'] + "',");
        code.push("\t\tjobManWorkDir='.',");
        code.push("\t\tmaxJobs=10");
        code.push("\t).runServer()");
        code.push("");
    }

    return formatCodeToText(replace_tabs_with_spaces_for_each_line(code));
}